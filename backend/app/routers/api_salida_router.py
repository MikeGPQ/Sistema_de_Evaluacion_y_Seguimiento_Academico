from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.academic_group import AcademicGroup
from app.models.academic_period import AcademicPeriod
from app.models.sigad_group import SigadGroup
from app.models.subject import Subject
from app.models.teacher import Teacher

router = APIRouter(prefix="/api", tags=["Salida SIGAD"])

def paginate(query, page: int, page_size: int):
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def validate_pagination(page: int, page_size: int):
    if page < 1:
        raise HTTPException(status_code=400, detail="page debe ser >= 1")
    if page_size < 1 or page_size > 100:
        raise HTTPException(status_code=400, detail="page_size debe estar entre 1 y 100")


@router.get("/materias/recepcion")
def get_materias(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    periodo_activo = db.query(AcademicPeriod).filter(AcademicPeriod.is_active == True).first()
    if not periodo_activo:
        raise HTTPException(status_code=404, detail="No hay periodo activo configurado")

    query = db.query(Subject).filter(Subject.period_id == periodo_activo.id)
    items, total = paginate(query, page, page_size)

    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "data": [
            {
                "id_materia": s.id,
                "codigo_unico": s.codigo_unico,
                "nombre": s.nombre,
            }
            for s in items
        ],
    }


@router.get("/grupos/recepcion")
def get_grupos(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(SigadGroup)
    items, total = paginate(query, page, page_size)

    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "data": [
            {
                "id_grupo": g.id,
                "identificador": g.identificador,
            }
            for g in items
        ],
    }


@router.get("/asignaciones/recepcion")
def get_asignaciones(
    materia_id: Optional[int] = Query(None),
    grupo_id: Optional[int] = Query(None),
    periodo_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    if materia_id is not None and grupo_id is not None:
        return _promedio_consolidado(materia_id, grupo_id, db)

    if grupo_id is not None and periodo_id is not None:
        return _incumplimientos(grupo_id, periodo_id, page, page_size, db)

    raise HTTPException(
        status_code=400,
        detail="Parámetros inválidos. Use materia_id+grupo_id o grupo_id+periodo_id.",
    )


def _promedio_consolidado(materia_id: int, grupo_id: int, db: Session):
    asignacion = (
        db.query(AcademicGroup)
        .filter(
            AcademicGroup.subject_id == materia_id,
            AcademicGroup.sigad_group_id == grupo_id,
        )
        .first()
    )
    if not asignacion:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")

    promedio = float(asignacion.promedio_consolidado) if asignacion.promedio_consolidado is not None else None

    return {
        "id_asignacion": asignacion.id,
        "promedio_consolidado": promedio,
    }


def _incumplimientos(
    grupo_id: int, periodo_id: int, page: int, page_size: int, db: Session
):
    query = (
        db.query(AcademicGroup)
        .filter(
            AcademicGroup.sigad_group_id == grupo_id,
            AcademicGroup.period_id == periodo_id,
        )
    )

    total = query.count()
    if total == 0:
        raise HTTPException(status_code=404, detail="No se encontraron asignaciones")

    items = query.offset((page - 1) * page_size).limit(page_size).all()

    data = []
    for ag in items:
        teacher = db.query(Teacher).filter(Teacher.id == ag.teacher_id).first()
        data.append(
            {
                "id_asignacion": ag.id,
                "docente_id": teacher.sigad_docente_id if teacher else None,
                "tiene_reporte_externo": 1 if ag.tiene_reporte_externo else 0,
            }
        )

    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "data": data,
    }