from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from datetime import datetime
from app.db.database import get_db
from app.models.student import Student
from app.models.career import Career
from app.models.student_status_log import StudentStatusLog 

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

# Actualizamos el modelo para recibir el ID o identificador del usuario
class UpdateEstatusRequest(BaseModel):
    estatus: str
    usuario_id: str = None # Recibimos el ID real del admin/docente

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

    # 1. Capturamos el estatus viejo antes de cambiarlo
    estatus_anterior = alumno.status
    
    # 2. Actualizamos el estatus del alumno
    alumno.status = request.estatus
    
    # 3. Guardamos el movimiento en la tabla de Logs SIEMPRE que haya un cambio real
    if estatus_anterior != request.estatus:
        nuevo_log = StudentStatusLog(
            student_matricula=alumno.matricula,
            changed_by_user=request.usuario_id or "Sistema Desconocido",
            previous_status=estatus_anterior,
            new_status=request.estatus
        )
        db.add(nuevo_log)

    # Confirmamos los cambios en ambas tablas al mismo tiempo (Transacción atómica)
    db.commit()
    
    return {"message": "Estatus y Log actualizados correctamente", "nuevo_estatus": alumno.status}