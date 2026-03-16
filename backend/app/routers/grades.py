import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.academic_group import AcademicGroup
from app.models.academic_period import AcademicPeriod
from app.models.enrollment import StudentEnrollment
from app.models.grade_status import GradeStatus
from app.models.teacher import Teacher
from app.models.subject import Subject
from app.schemas.enrollment import BulkGradeUpdateRequest
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/docente", tags=["Docente - Calificaciones"])


# ──────────────────────────────────────────────
# GET  /docente/periodos
# Devuelve todos los periodos académicos del catálogo
# ──────────────────────────────────────────────
@router.get("/periodos")
def get_periods(db: Session = Depends(get_db)):
    periods = (
        db.query(AcademicPeriod)
        .order_by(AcademicPeriod.fecha_inicio.asc())
        .all()
    )
    return [
        {
            "period_name": p.period_name,
            "is_active": p.is_active,
        }
        for p in periods
    ]


# ──────────────────────────────────────────────
# GET  /docente/grade-statuses
# Devuelve los códigos de justificación disponibles para el docente
# (solo los que tienen is_manual_justification = True)
# ──────────────────────────────────────────────
@router.get("/grade-statuses")
def get_grade_statuses(db: Session = Depends(get_db)):
    statuses = (
        db.query(GradeStatus)
        .filter(GradeStatus.is_manual_justification == True)
        .all()
    )
    return [{"code": s.code, "label": s.description} for s in statuses]


def _format_horario(horario_json) -> str:
    try:
        h = horario_json
        if isinstance(h, str):
            h = json.loads(h)
        if isinstance(h, list) and h:
            parts = [f"{s.get('dia', '')} {s.get('inicio', '')}-{s.get('fin', '')}" for s in h]
            return " y ".join(parts)
        if isinstance(h, dict):
            parts = [f"{dia.capitalize()} {horas}" for dia, horas in h.items()]
            return " y ".join(parts)
    except Exception:
        pass
    return "Horario por definir"


# ──────────────────────────────────────────────
# GET  /docente/{teacher_external_id}/grupos
# Devuelve todos los grupos asignados al docente
# ──────────────────────────────────────────────
@router.get("/{teacher_external_id}/grupos")
def get_teacher_groups(
    teacher_external_id: str,
    periodo: str = Query(default="2026-1"),
    db: Session = Depends(get_db),
):
    teacher = db.query(Teacher).filter(Teacher.external_id == teacher_external_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Docente no encontrado.")

    rows = (
        db.query(AcademicGroup, Subject)
        .join(Subject, AcademicGroup.subject_id == Subject.id)
        .filter(
            AcademicGroup.teacher_id == teacher.id,
            AcademicGroup.periodo == periodo,
        )
        .all()
    )

    result = []
    for g, subject in rows:
        result.append({
            "group_id": g.id,
            "teacher_id": teacher.id,
            "identificador_grupo": g.identificador_grupo,
            "subject_nombre": subject.nombre,
            "cuatrimestre": subject.cuatrimestre,
            "horario": _format_horario(g.horario_json),
            "acta_status": g.acta_status,
            "periodo": g.periodo,
        })

    return result


# ──────────────────────────────────────────────
# GET  /docente/grupos/{group_id}/alumnos
# Devuelve los alumnos inscritos en el grupo con sus calificaciones
# ──────────────────────────────────────────────
@router.get("/grupos/{group_id}/alumnos")
def get_group_students(group_id: int, db: Session = Depends(get_db)):
    group = db.query(AcademicGroup).filter(AcademicGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado.")

    enrollments = (
        db.query(StudentEnrollment)
        .filter(StudentEnrollment.academic_group_id == group_id)
        .all()
    )

    result = []
    for e in enrollments:
        student = e.student
        nombre = (
            f"{student.nombre} {student.apellido_paterno} {student.apellido_materno}".strip()
            if student else "Alumno desconocido"
        )
        result.append({
            "matricula": e.student_matricula,
            "nombre": nombre,
            "p1": e.parcial_1,
            "s1": e.status_parcial_1 if e.parcial_1 is not None else None,
            "p2": e.parcial_2,
            "s2": e.status_parcial_2 if e.parcial_2 is not None else None,
            "p3": e.parcial_3,
            "s3": e.status_parcial_3 if e.parcial_3 is not None else None,
        })

    return result


# ──────────────────────────────────────────────
# PUT  /docente/grupos/{group_id}/calificaciones
# Guardado masivo de calificaciones (HU-20 / HU-21)
# ──────────────────────────────────────────────
@router.put("/grupos/{group_id}/calificaciones")
def bulk_update_grades(group_id: int, data: BulkGradeUpdateRequest, db: Session = Depends(get_db)):

    group = db.query(AcademicGroup).filter(AcademicGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado.")

    if group.acta_status == 'cerrada':
        raise HTTPException(
            status_code=403,
            detail="El acta de este grupo ya está cerrada. No se permiten modificaciones en Solo Lectura."
        )

    # Resolvemos el identifier del docente para auditoría
    teacher = db.query(Teacher).filter(Teacher.id == group.teacher_id).first()
    audit_identifier = teacher.external_id if teacher else str(data.docente_id)
    cambios_realizados = 0

    for student_data in data.students:
        enrollment = db.query(StudentEnrollment).filter(
            StudentEnrollment.academic_group_id == group_id,
            StudentEnrollment.student_matricula == student_data.student_matricula
        ).first()

        if not enrollment:
            continue

        old_values = {}
        new_values = {}

        def update_parcial(num_parcial, new_score, new_status):
            attr_score = f'parcial_{num_parcial}'
            attr_status = f'status_parcial_{num_parcial}'

            current_score = getattr(enrollment, attr_score)
            current_status = getattr(enrollment, attr_status)

            if new_score is not None and current_score != new_score:
                old_values[attr_score] = current_score
                old_values[attr_status] = current_status

                setattr(enrollment, attr_score, new_score)
                setattr(enrollment, attr_status, new_status if new_status else "OE")

                new_values[attr_score] = getattr(enrollment, attr_score)
                new_values[attr_status] = getattr(enrollment, attr_status)

        update_parcial(1, student_data.parcial_1, student_data.status_parcial_1)
        update_parcial(2, student_data.parcial_2, student_data.status_parcial_2)
        update_parcial(3, student_data.parcial_3, student_data.status_parcial_3)

        # Cálculo de Promedio Ponderado (HU-21)
        if enrollment.parcial_1 is not None and enrollment.parcial_2 is not None and enrollment.parcial_3 is not None:
            promedio_exacto = (enrollment.parcial_1 * 0.3) + (enrollment.parcial_2 * 0.3) + (enrollment.parcial_3 * 0.4)
            enrollment.calificacion_final = round(promedio_exacto)
            enrollment.status = "aprobada" if enrollment.calificacion_final >= 7 else "reprobada"
        else:
            enrollment.calificacion_final = None
            enrollment.status = "cursando"

        if new_values:
            log_audit_event(
                db=db,
                user_identifier=audit_identifier,
                action="UPDATE",
                entity_name="student_enrollments",
                entity_id=str(enrollment.id),
                old_values=old_values,
                new_values=new_values
            )
            cambios_realizados += 1

    db.commit()

    return {
        "message": "Calificaciones actualizadas y promedios calculados correctamente.",
        "alumnos_modificados": cambios_realizados
    }
