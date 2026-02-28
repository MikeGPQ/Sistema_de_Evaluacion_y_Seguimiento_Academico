from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from datetime import datetime
from app.db.database import get_db
from app.models.student import Student
from app.models.career import Career

router = APIRouter(prefix="/alumnos", tags=["Alumnos"])

class AlumnoListado(BaseModel):
    matricula: str
    nombre_completo: str
    carrera: str
    estatus: str

    class Config:
        from_attributes = True

@router.get("/listado", response_model=dict)
def listar_alumnos(
    skip: int = 0, 
    limit: int = 10, 
    db: Session = Depends(get_db)
):
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

# Actualizamos el modelo para recibir al usuario que hace el cambio
class UpdateEstatusRequest(BaseModel):
    estatus: str
    usuario_accion: str = None # el frontend puede enviar el nombre del usuario que realiza la accion

@router.put("/{matricula}/estatus")
def cambiar_estatus(
    matricula: str, 
    request: UpdateEstatusRequest, 
    db: Session = Depends(get_db)
):
    alumno = db.query(Student).filter(Student.matricula == matricula).first()
    
    if not alumno:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    
    estatus_validos = ['activo', 'baja', 'baja_temporal', 'egresado']
    if request.estatus not in estatus_validos:
        raise HTTPException(status_code=400, detail="Estatus no válido")

    # Si se cambia a baja o baja temporal, registramos quién y cuándo
    if request.estatus in ['baja', 'baja_temporal']:
        alumno.baja_por = request.usuario_accion or "Administrador Desconocido"
        alumno.fecha_baja = datetime.now()
    else:
        # si se reactiva el alumno o se egresa, limpiamos los campos de baja
        alumno.baja_por = None
        alumno.fecha_baja = None

    alumno.status = request.estatus
    db.commit()
    
    return {"message": "Estatus actualizado correctamente", "nuevo_estatus": alumno.status}