from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from datetime import datetime
from app.db.database import get_db
from app.models.student import Student
from app.models.student_status import StudentStatus
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
        StudentStatus.name.label('estatus')
    ).join(
        Career, Student.career_id == Career.id
    ).join(
        StudentStatus, Student.status_id == StudentStatus.id
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

class UpdateEstatusRequest(BaseModel):
    status_id: int
    usuario_id: str = None

@router.put("/{matricula}/estatus")
def cambiar_estatus(
    matricula: str,
    request: UpdateEstatusRequest,
    db: Session = Depends(get_db)
):
    alumno = db.query(Student).filter(Student.matricula == matricula).first()
    if not alumno:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")

    nuevo_estatus = db.query(StudentStatus).filter(StudentStatus.id == request.status_id).first()
    if not nuevo_estatus:
        raise HTTPException(status_code=400, detail="Estatus no válido")

    # 1. Capturamos el status_id anterior antes de cambiarlo
    status_id_anterior = alumno.status_id

    # 2. Actualizamos el status_id del alumno
    alumno.status_id = request.status_id

    # 3. Guardamos el movimiento en la tabla de Logs si hubo cambio real
    if status_id_anterior != request.status_id:
        nuevo_log = StudentStatusLog(
            student_matricula=alumno.matricula,
            changed_by_user=request.usuario_id or "Sistema Desconocido",
            previous_status_id=status_id_anterior,
            new_status_id=request.status_id
        )
        db.add(nuevo_log)

    # Confirmamos los cambios en ambas tablas al mismo tiempo (Transacción atómica)
    db.commit()

    return {"message": "Estatus y Log actualizados correctamente", "nuevo_estatus": nuevo_estatus.name}