from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.database import get_db
from app.models.academic_group import AcademicGroup
from app.models.academic_period import AcademicPeriod
from app.models.enrollment import StudentEnrollment
from app.models.grade_status import GradeStatus
from app.models.grade_value import GradeValue
from app.models.teacher import Teacher
from app.models.subject import Subject
from app.schemas.enrollment import BulkGradeUpdateRequest
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/docente", tags=["Docente - Calificaciones"])

@router.get("/periodos")
def get_periods(db: Session = Depends(get_db)):
    periods = db.query(AcademicPeriod).order_by(AcademicPeriod.id.desc()).all()
    return [{"id": p.id, "period_name": p.period_name, "is_active": p.is_active} for p in periods]

@router.get("/grade-statuses")
def get_grade_statuses(all_statuses: bool = False, db: Session = Depends(get_db)):
    query = db.query(GradeStatus)
    if not all_statuses:
        query = query.filter(GradeStatus.is_manual_justification == True)
    statuses = query.all()
    return [{"code": s.code, "label": s.description} for s in statuses]

@router.get("/grade-values")
def get_grade_values(db: Session = Depends(get_db)):
    values = db.query(GradeValue).all()
    return [{"id": v.id, "value": v.value, "numeric": v.numeric_value} for v in values]

@router.get("/{teacher_matricula}/grupos")
def get_teacher_groups(
    teacher_matricula: str,
    periodo_id: int,
    db: Session = Depends(get_db),
):
    teacher = db.query(Teacher).filter(Teacher.matricula_empleado == teacher_matricula).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Docente no encontrado.")

    groups = (
        db.query(AcademicGroup)
        .join(Subject)
        .filter(AcademicGroup.teacher_id == teacher.id, AcademicGroup.period_id == periodo_id)
        .all()
    )

    return [{
        "group_id": g.id,
        "identificador_grupo": g.identificador_grupo,
        "subject_nombre": g.subject.nombre,
        "cuatrimestre": g.subject.quarter.nombre if g.subject.quarter else "N/A",
        "acta_status": g.acta_status,
        "horario": ", ".join([f"{s.dia_semana} {s.hora_inicio}-{s.hora_fin}" for s in g.schedules])
    } for g in groups]

@router.get("/grupos/{group_id}/alumnos")
def get_group_students(group_id: int, db: Session = Depends(get_db)):
    enrollments = db.query(StudentEnrollment).filter(StudentEnrollment.academic_group_id == group_id).all()
    
    result = []
    for e in enrollments:
        student = e.student
        result.append({
            "enrollment_id": e.id,
            "matricula": e.student_matricula,
            "nombre": f"{student.nombre} {student.apellido_paterno} {student.apellido_materno}",
            "p1": {"id": e.parcial_1_id, "val": e.parcial_1.value if e.parcial_1 else None},
            "p2": {"id": e.parcial_2_id, "val": e.parcial_2.value if e.parcial_2 else None},
            "p3": {"id": e.parcial_3_id, "val": e.parcial_3.value if e.parcial_3 else None},
            "final": e.calificacion_final
        })
    return result

@router.put("/grupos/{group_id}/calificaciones")
def bulk_update_grades(group_id: int, data: BulkGradeUpdateRequest, db: Session = Depends(get_db)):
    group = db.query(AcademicGroup).filter(AcademicGroup.id == group_id).first()
    if not group or group.acta_status == 'cerrada':
        raise HTTPException(status_code=403, detail="Acta cerrada o grupo no encontrado.")

    cambios = 0
    for s_data in data.students:
        enr = db.query(StudentEnrollment).filter(
            StudentEnrollment.academic_group_id == group_id,
            StudentEnrollment.student_matricula == s_data.student_matricula
        ).first()

        if not enr: continue

        # Actualizar IDs de GradeValue
        enr.parcial_1_id = s_data.p1_id
        enr.parcial_2_id = s_data.p2_id
        enr.parcial_3_id = s_data.p3_id
        
        # Lógica de Promedio Ponderado con numeric_value (SESA 3.0)
        if enr.parcial_1 and enr.parcial_2 and enr.parcial_3:
            v1 = enr.parcial_1.numeric_value
            v2 = enr.parcial_2.numeric_value
            v3 = enr.parcial_3.numeric_value
            
            promedio = (v1 * 0.3) + (v2 * 0.3) + (v3 * 0.4)
            enr.calificacion_final = round(promedio)
            enr.status = "aprobada" if enr.calificacion_final >= 6 else "reprobada"
        
        cambios += 1

    log_audit_event(db, data.docente_id, "UPDATE", "grades", str(group_id), None, {"alumnos": len(data.students)})
    db.commit()
    return {"message": "Calificaciones guardadas", "cambios": cambios}