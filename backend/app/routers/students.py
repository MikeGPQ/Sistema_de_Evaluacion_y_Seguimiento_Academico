from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from pydantic import BaseModel
from typing import List, Optional

# Importamos lo que acabamos de crear
from app.db.database import get_db
from app.models.student import Student
from app.models.career import Career
# from app.models.subject import Subject  # Lo usarás cuando tengas la tabla intermedia

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
    # NUEVO: Parámetro para la búsqueda de texto
    busqueda: Optional[str] = Query(None, description="Búsqueda por matrícula o nombre"),
    # Parámetros opcionales para los filtros
    carrera_id: Optional[int] = Query(None, description="ID de la carrera a filtrar"),
    cuatrimestre: Optional[int] = Query(None, description="Número de cuatrimestre a filtrar"),

    db: Session = Depends(get_db)
):
    # 1. Consulta Base: Solo los datos y el JOIN obligatorio
    query = db.query(
        Student.matricula,
        (Student.nombre + " " + Student.apellido_paterno + " " + Student.apellido_materno).label('nombre_completo'),
        Career.name.label('carrera'),
        Student.status.label('estatus')
    ).join(
        Career, Student.career_id == Career.id
    )

    # 2. Aplicar Filtros Dinámicos
    
    # Filtro de Búsqueda de Texto (Matrícula o Nombre Completo)
    if busqueda:
        termino = f"%{busqueda}%"
        query = query.filter(
            or_(
                Student.matricula.ilike(termino),
                (Student.nombre + " " + Student.apellido_paterno + " " + Student.apellido_materno).ilike(termino)
            )
        )

    if carrera_id:
        query = query.filter(Student.career_id == carrera_id)

    if cuatrimestre:
        query = query.filter(Student.cuatrimestre_actual == cuatrimestre)


    # 3. Contar el total de registros YA FILTRADOS (vital para que tu paginación no se rompa)
    total = query.count()
    
    # 4. Aplicar Paginación (offset y limit van SIEMPRE al final)
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