from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.student_status import StudentStatus
from app.models.academic_level import AcademicLevel
from app.models.academic_program import AcademicProgram
from app.models.academic_period import AcademicPeriod
from app.models.origin_school import OriginSchool
from app.models.quarter_catalog import QuarterCatalog
from app.models.titulation_status import TitulationStatus
from app.models.classroom import Classroom

router = APIRouter(prefix="/catalogos", tags=["Catálogos"])

@router.get("/estatus-alumno")
def get_estatus_alumno(db: Session = Depends(get_db)):
    estatus = db.query(StudentStatus).all()
    return [{"id": s.id, "name": s.name, "description": s.description} for s in estatus]

@router.get("/niveles-academicos")
def get_niveles(db: Session = Depends(get_db)):
    niveles = db.query(AcademicLevel).all()
    return [{"id": n.id, "name": n.name} for n in niveles]

@router.get("/programas-academicos")
def get_programas(nivel_id: int = None, db: Session = Depends(get_db)):
    query = db.query(AcademicProgram)
    if nivel_id:
        query = query.filter(AcademicProgram.nivel_id == nivel_id)
    programas = query.all()
    return [{"id": p.id, "name": p.name, "nivel_id": p.nivel_id} for p in programas]

@router.get("/periodos")
def get_periodos(solo_activos: bool = False, db: Session = Depends(get_db)):
    query = db.query(AcademicPeriod).order_by(AcademicPeriod.id.desc())
    if solo_activos:
        query = query.filter(AcademicPeriod.is_active == True)
    periodos = query.all()
    return [{"id": p.id, "name": p.period_name, "is_active": p.is_active} for p in periodos]

@router.get("/escuelas-procedencia")
def get_escuelas(tipo: str = None, db: Session = Depends(get_db)):
    query = db.query(OriginSchool).filter(OriginSchool.is_active == True)
    if tipo:
        query = query.filter(OriginSchool.tipo == tipo)
    escuelas = query.all()
    return [{"id": e.id, "name": e.name, "tipo": e.tipo} for e in escuelas]

@router.get("/cuatrimestres")
def get_cuatrimestres(db: Session = Depends(get_db)):
    cuatrimestres = db.query(QuarterCatalog).order_by(QuarterCatalog.external_id.asc()).all()
    return [{"id": c.id, "numero": c.external_id, "nombre": c.nombre} for c in cuatrimestres]

@router.get("/estatus-titulacion")
def get_estatus_titulacion(db: Session = Depends(get_db)):
    estatus = db.query(TitulationStatus).all()
    return [{"id": t.id, "name": t.name} for t in estatus]

@router.get("/aulas")
def get_aulas(db: Session = Depends(get_db)):
    aulas = db.query(Classroom).all()
    return [{"id": a.id, "nombre": a.nombre_codigo, "capacidad": a.capacidad} for a in aulas]