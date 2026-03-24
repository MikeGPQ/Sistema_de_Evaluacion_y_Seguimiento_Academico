import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

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

DIAS_MAP = {1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado", 7: "Domingo"}

def _format_schedules_v3(schedules) -> str:
    if not schedules:
        return "Horario por definir"
    parts = []
    for s in schedules:
        dia = DIAS_MAP.get(s.dia_semana, "")
        ini = s.hora_inicio.strftime("%H:%M") if s.hora_inicio else ""
        fin = s.hora_fin.strftime("%H:%M") if s.hora_fin else ""
        parts.append(f"{dia} {ini}-{fin}")
    return " y ".join(parts) if parts else "Horario por definir"


@router.get("/periodos")
def get_periods(db: Session = Depends(get_db)):
    periods = db.query(AcademicPeriod).order_by(AcademicPeriod.fecha_inicio.asc()).all()
    return [{"codigo": p.codigo, "is_active": p.is_active} for p in periods]

@router.get("/grade-values")
def get_grade_values(db: Session = Depends(get_db)):
    values = db.query(GradeValue).order_by(GradeValue.id.asc()).all()
    return [{"id": gv.id, "value": gv.value, "numeric_value": gv.numeric_value} for gv in values]


@router.get("/grade-statuses")
def get_grade_statuses(all: bool = False, db: Session = Depends(get_db)):
    query = db.query(GradeStatus)
    if not all:
        query = query.filter(GradeStatus.is_manual_justification == True)
    statuses = query.all()
    return [{"code": s.code, "label": s.description} for s in statuses]


@router.get("/{teacher_external_id}/grupos")
def get_teacher_groups(
    teacher_external_id: str,
    periodo: str = Query(default="2026-1"),
    db: Session = Depends(get_db),
):
    teacher = db.query(Teacher).filter(Teacher.matricula_empleado == teacher_external_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Docente no encontrado.")

    period_obj = db.query(AcademicPeriod).filter(AcademicPeriod.codigo == periodo).first()
    if not period_obj:
        return []

    grupos = (
        db.query(AcademicGroup)
        .filter(
            AcademicGroup.teacher_id == teacher.id,
            AcademicGroup.period_id == period_obj.id,
        )
        .all()
    )

    result = []
    for g in grupos:
        materia = g.subject
        cuatrimestre_val = None
        if materia:
            if hasattr(materia, 'quarter') and materia.quarter:
                cuatrimestre_val = materia.quarter.external_id
            else:
                cuatrimestre_val = getattr(materia, 'quarter_id', None)
        
        result.append({
            "group_id": g.id,
            "teacher_id": teacher.id,
            "identificador_grupo": g.sigad_group.identificador if g.sigad_group else None,
            "subject_nombre": materia.nombre if materia else "Sin Materia",
            "cuatrimestre": cuatrimestre_val,
            "horario": _format_schedules_v3(g.schedules),
            "acta_status": g.estatus_acta.lower() if g.estatus_acta else "abierta",
            "periodo": period_obj.codigo,
        })

    return result


@router.get("/grupos/{group_id}/alumnos")
def get_group_students(group_id: int, db: Session = Depends(get_db)):
    group = db.query(AcademicGroup).filter(AcademicGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado.")

    enrollments = db.query(StudentEnrollment).filter(StudentEnrollment.academic_group_id == group_id).all()

    grade_values_map = {gv.id: gv.value for gv in db.query(GradeValue).all()}

    result = []
    for e in enrollments:
        student = e.student
        nombre = f"{student.nombre} {student.apellido_paterno} {student.apellido_materno}".strip() if student else "Alumno desconocido"

        p1_val = grade_values_map.get(e.parcial_1_id) if e.parcial_1_id else None
        p2_val = grade_values_map.get(e.parcial_2_id) if e.parcial_2_id else None
        p3_val = grade_values_map.get(e.parcial_3_id) if e.parcial_3_id else None

        result.append({
            "matricula": e.student_matricula,
            "nombre": nombre,
            "p1": p1_val, "s1": e.status_parcial_1,
            "p2": p2_val, "s2": e.status_parcial_2,
            "p3": p3_val, "s3": e.status_parcial_3,
        })

    return result


@router.put("/grupos/{group_id}/calificaciones")
def bulk_update_grades(group_id: int, data: BulkGradeUpdateRequest, db: Session = Depends(get_db)):
    group = db.query(AcademicGroup).filter(AcademicGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado.")

    if group.estatus_acta == 'CERRADA':
        raise HTTPException(status_code=403, detail="El acta de este grupo ya está cerrada.")

    teacher = db.query(Teacher).filter(Teacher.id == group.teacher_id).first()
    audit_identifier = teacher.matricula_empleado if teacher else str(data.docente_id)
    cambios_realizados = 0

    id_to_numeric = {gv.id: gv.numeric_value for gv in db.query(GradeValue).all()}

    for student_data in data.students:
        enrollment = db.query(StudentEnrollment).filter(
            StudentEnrollment.academic_group_id == group_id,
            StudentEnrollment.student_matricula == student_data.student_matricula
        ).first()

        if not enrollment:
            continue

        old_values, new_values = {}, {}

        def update_parcial(num_parcial, new_score_num, new_status_code):
            attr_score = f'parcial_{num_parcial}_id'
            attr_status = f'status_parcial_{num_parcial}'

            current_score = getattr(enrollment, attr_score, None)
            current_status = getattr(enrollment, attr_status, None)

            target_score = new_score_num  # es el grade_value.id enviado por el frontend
            target_status = new_status_code or "OE"

            if current_score != target_score or current_status != target_status:
                old_values[attr_score] = current_score
                old_values[attr_status] = current_status

                setattr(enrollment, attr_score, target_score)
                setattr(enrollment, attr_status, target_status)

                new_values[attr_score] = target_score
                new_values[attr_status] = target_status

        update_parcial(1, student_data.parcial_1, student_data.status_parcial_1)
        update_parcial(2, student_data.parcial_2, student_data.status_parcial_2)
        update_parcial(3, student_data.parcial_3, student_data.status_parcial_3)

        if student_data.parcial_1 is not None and student_data.parcial_2 is not None and student_data.parcial_3 is not None:
            n1 = id_to_numeric.get(student_data.parcial_1, 0)
            n2 = id_to_numeric.get(student_data.parcial_2, 0)
            n3 = id_to_numeric.get(student_data.parcial_3, 0)
            promedio_exacto = (n1 * 0.3) + (n2 * 0.3) + (n3 * 0.4)
            enrollment.calificacion_final = round(promedio_exacto)
            enrollment.status = "aprobada" if enrollment.calificacion_final >= 7 else "reprobada"
        else:
            enrollment.calificacion_final = None
            enrollment.status = "cursando"

        if new_values:
            log_audit_event(
                db=db, user_identifier=audit_identifier, action="UPDATE",
                entity_name="student_enrollments", entity_id=str(enrollment.id),
                old_values=old_values, new_values=new_values
            )
            cambios_realizados += 1

    db.commit()

    return {
        "message": "Calificaciones actualizadas y promedios calculados correctamente.",
        "alumnos_modificados": cambios_realizados
    }