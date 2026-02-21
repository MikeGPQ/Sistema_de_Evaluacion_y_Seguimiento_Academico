from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List

# Importamos SOLO lo que acabamos de crear
from app.db.database import get_db
from app.models.student import Student
from app.models.career import Career
#importación del la neuva funcion para cambiar estatus del alumno 
from fastapi import HTTPException

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

# --- ESQUEMA PARA ACTUALIZAR ---
class UpdateEstatusRequest(BaseModel):
    estatus: str

# --- ENDPOINT DE CAMBIO DE ESTATUS (HU-07) ---
@router.put("/{matricula}/estatus")
def cambiar_estatus(
    matricula: str, 
    request: UpdateEstatusRequest, 
    db: Session = Depends(get_db)
):
    # 1. Buscamos al alumno por su matrícula
    alumno = db.query(Student).filter(Student.matricula == matricula).first()
    
    # 2. Si no existe, lanzamos error
    if not alumno:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    
    # 3. Validamos que el estatus sea uno de los permitidos en tu base de datos
    estatus_validos = ['activo', 'baja', 'baja_temporal', 'egresado']
    if request.estatus not in estatus_validos:
        raise HTTPException(status_code=400, detail="Estatus no válido")

    # 4. Actualizamos y guardamos
    alumno.status = request.estatus
    db.commit()
    
    return {"message": "Estatus actualizado correctamente", "nuevo_estatus": alumno.status}