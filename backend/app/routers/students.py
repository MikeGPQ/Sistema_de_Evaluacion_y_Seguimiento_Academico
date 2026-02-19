from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List

# Importamos SOLO lo que acabamos de crear
from app.db.database import get_db
from app.models.student import Student
from app.models.career import Career

router = APIRouter(prefix="/alumnos", tags=["Alumnos"])

# --- ESQUEMA DE RESPUESTA ---
class AlumnoListado(BaseModel):
    matricula: str
    nombre_completo: str
    carrera: str
    estatus: str

    class Config:
        from_attributes = True

# --- ENDPOINT DE LISTADO (HU-03) ---
@router.get("/listado", response_model=dict)
def listar_alumnos(
    skip: int = 0, 
    limit: int = 10, 
    db: Session = Depends(get_db)
):
    # Consulta optimizada: JOIN entre Alumno y Carrera
    query = db.query(
        Student.matricula,
        (Student.nombre + " " + Student.apellido_paterno + " " + Student.apellido_materno).label('nombre_completo'),
        Career.name.label('carrera'),
        Student.status.label('estatus')
    ).join(
        Career, Student.career_id == Career.id
    )

    total = query.count()
    alumnos = query.offset(skip).limit(limit).all()

    # Formateo de datos para el frontend
    data = []
    for row in alumnos:
        data.append({
            "matricula": row.matricula,
            "nombre_completo": row.nombre_completo or "Sin Nombre",
            "carrera": row.carrera or "Sin Carrera",
            "estatus": row.estatus
        })

    return {
        "total": total,
        "data": data
    }