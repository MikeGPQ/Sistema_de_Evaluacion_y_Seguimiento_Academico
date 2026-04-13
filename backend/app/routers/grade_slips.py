from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.db.database import get_db
from app.models.student import Student
from app.models.student_academic_profile import StudentAcademicProfile
from app.models.enrollment import StudentEnrollment
from app.models.academic_group import AcademicGroup
from app.models.academic_period import AcademicPeriod
from app.models.grade_value import GradeValue
from app.models.sigad_group import SigadGroup
from app.models.quarter_catalog import QuarterCatalog

router = APIRouter(prefix="/boletas", tags=["Boletas"])


def _get_active_period(db: Session):
    return db.query(AcademicPeriod).filter(AcademicPeriod.is_active == True).first()


def _get_grade_values_map(db: Session):
    gvs = db.query(GradeValue).all()
    return {gv.id: gv.numeric_value for gv in gvs}


def _get_enrollments_data(perfil_id: int, periodo_id: int, db: Session, grade_map: dict):
    enrollments = (
        db.query(StudentEnrollment)
        .join(AcademicGroup, StudentEnrollment.academic_group_id == AcademicGroup.id)
        .filter(
            StudentEnrollment.academic_profile_id == perfil_id,
            AcademicGroup.period_id == periodo_id,
        )
        .all()
    )

    result = []
    for e in enrollments:
        materia_nombre = (
            e.academic_group.subject.nombre
            if e.academic_group and e.academic_group.subject
            else "Sin Materia"
        )
        p1 = grade_map.get(e.parcial_1_id) if e.parcial_1_id else None
        p2 = grade_map.get(e.parcial_2_id) if e.parcial_2_id else None
        p3 = grade_map.get(e.parcial_3_id) if e.parcial_3_id else None
        acta_status = (
            e.academic_group.estatus_acta.lower()
            if e.academic_group and e.academic_group.estatus_acta
            else "abierta"
        )
        result.append((e, materia_nombre, p1, p2, p3, acta_status))

    return result


def _build_boleta(student, perfil, enrollments_data, periodo_codigo):
    nombre_completo = f"{student.nombre} {student.apellido_paterno} {student.apellido_materno or ''}".strip()
    carrera = perfil.career.name if perfil.career else "Sin Carrera"
    try:
        cuatrimestre = (
            int(perfil.quarter_actual.external_id)
            if perfil.quarter_actual
            else perfil.quarter_actual_id
        )
    except Exception:
        cuatrimestre = perfil.quarter_actual_id

    materias = []
    for (e, materia_nombre, p1, p2, p3, acta_status) in enrollments_data:
        materias.append({
            "nombre": materia_nombre,
            "parcial_1": p1,
            "parcial_2": p2,
            "parcial_3": p3,
            "promedio": e.calificacion_final,
            "estatus": e.status,
            "acta_status": acta_status,
        })

    materias.sort(key=lambda m: m["nombre"])

    return {
        "alumno": {
            "nombre": nombre_completo,
            "matricula": student.matricula,
            "carrera": carrera,
            "cuatrimestre": cuatrimestre,
        },
        "periodo": periodo_codigo,
        "materias": materias,
    }


@router.get("/buscar-alumno")
def buscar_alumno(q: str = Query(..., min_length=2), db: Session = Depends(get_db)):
    """Busca alumnos por matrícula o nombre para el modo individual."""
    termino = f"%{q}%"
    alumnos = (
        db.query(Student)
        .filter(
            or_(
                Student.matricula.ilike(termino),
                Student.nombre.ilike(termino),
                Student.apellido_paterno.ilike(termino),
                Student.apellido_materno.ilike(termino),
            )
        )
        .limit(10)
        .all()
    )
    result = []
    for a in alumnos:
        nombre = f"{a.nombre} {a.apellido_paterno} {a.apellido_materno or ''}".strip()
        result.append({"matricula": a.matricula, "nombre": nombre})
    return result


@router.get("/alumno/{matricula}")
def get_boleta_alumno(matricula: str, db: Session = Depends(get_db)):
    """Retorna los datos de la boleta para un alumno específico en el periodo activo."""
    alumno = db.query(Student).filter(Student.matricula == matricula).first()
    if not alumno:
        raise HTTPException(status_code=404, detail="Alumno no encontrado.")

    perfil = (
        db.query(StudentAcademicProfile)
        .filter(StudentAcademicProfile.student_matricula == matricula)
        .order_by(StudentAcademicProfile.id.desc())
        .first()
    )
    if not perfil:
        raise HTTPException(status_code=404, detail="El alumno no tiene perfil académico registrado.")

    periodo = _get_active_period(db)
    if not periodo:
        raise HTTPException(status_code=400, detail="No hay periodo académico activo.")

    grade_map = _get_grade_values_map(db)
    enrollments_data = _get_enrollments_data(perfil.id, periodo.id, db, grade_map)

    return _build_boleta(alumno, perfil, enrollments_data, periodo.codigo)


@router.get("/grupos-disponibles")
def get_grupos_disponibles(
    carrera_id: int = None,
    cuatrimestre: int = None,
    db: Session = Depends(get_db),
):
    """Retorna los grupos (sigad_groups) disponibles para los filtros del modo masivo."""
    query = db.query(SigadGroup)
    if carrera_id:
        query = query.filter(SigadGroup.career_id == carrera_id)
    if cuatrimestre is not None:
        query = query.join(
            QuarterCatalog, SigadGroup.quarter_id == QuarterCatalog.id
        ).filter(QuarterCatalog.external_id == cuatrimestre)
    grupos = query.order_by(SigadGroup.identificador.asc()).all()
    return [{"id": g.id, "identificador": g.identificador} for g in grupos]


@router.get("/masivo")
def get_boletas_masivo(
    carrera_id: int = Query(...),
    cuatrimestre: int = Query(...),
    sigad_group_id: int = Query(None),
    db: Session = Depends(get_db),
):
    """Retorna las boletas de todos los alumnos del grupo/carrera/cuatrimestre indicado."""
    periodo = _get_active_period(db)
    if not periodo:
        raise HTTPException(status_code=400, detail="No hay periodo académico activo.")

    grade_map = _get_grade_values_map(db)

    query = (
        db.query(StudentAcademicProfile)
        .join(QuarterCatalog, StudentAcademicProfile.quarter_actual_id == QuarterCatalog.id)
        .filter(
            StudentAcademicProfile.career_id == carrera_id,
            QuarterCatalog.external_id == cuatrimestre,
        )
    )
    if sigad_group_id:
        query = query.filter(StudentAcademicProfile.sigad_group_id == sigad_group_id)

    perfiles = query.all()

    if not perfiles:
        raise HTTPException(
            status_code=404,
            detail="No se encontraron alumnos con los filtros seleccionados.",
        )

    boletas = []
    for perfil in perfiles:
        alumno = perfil.student
        if not alumno:
            continue
        enrollments_data = _get_enrollments_data(perfil.id, periodo.id, db, grade_map)
        boleta = _build_boleta(alumno, perfil, enrollments_data, periodo.codigo)
        boletas.append(boleta)

    boletas.sort(key=lambda b: b["alumno"]["nombre"])
    return boletas
