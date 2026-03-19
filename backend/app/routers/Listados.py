from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from datetime import datetime
from app.db.database import get_db
from app.models.student import Student
from app.models.student_status import StudentStatus
from app.models.career import Career
from app.models.student_status_log import StudentStatusLog
from app.models.file import File as FileModel
from app.models.enrollment import StudentEnrollment
from app.services.audit_service import log_audit_event

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

@router.put("/{matricula}/estatus")
def cambiar_estatus(
    matricula: str,
    status_id: int = Form(...),
    usuario_id: str = Form(None),
    evidence_file: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    alumno = db.query(Student).filter(Student.matricula == matricula).first()
    if not alumno:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")

    nuevo_estatus = db.query(StudentStatus).filter(StudentStatus.id == status_id).first()
    if not nuevo_estatus:
        raise HTTPException(status_code=400, detail="Estatus no vÃ¡lido")

    if nuevo_estatus.name in ('baja', 'baja_temporal') and not evidence_file:
        raise HTTPException(status_code=400, detail="Se requiere un archivo de evidencia para este estatus.")

    try:
        evidence_file_id = None
        if evidence_file:
            content = evidence_file.file.read()
            file_record = FileModel(
                file_name=evidence_file.filename,
                mime_type=evidence_file.content_type or "application/octet-stream",
                size_bytes=len(content),
                file_content=content
            )
            db.add(file_record)
            db.flush()
            evidence_file_id = file_record.id

        old_status_values = {"status_id": alumno.status_id}
        
        inscripciones_borradas = []
        if nuevo_estatus.name in ('baja', 'baja_temporal', 'egresado'):
            inscripciones_viejas = db.query(StudentEnrollment).filter(
                StudentEnrollment.student_matricula == matricula
            ).all()
            inscripciones_borradas = [insc.academic_group_id for insc in inscripciones_viejas]

        status_id_anterior = alumno.status_id
        alumno.status_id = status_id

        
        # Limpieza de horarios 
        # Si el alumno pasa a inactivo, borramos sus inscripciones para liberar cupo
        
        if nuevo_estatus.name in ('baja', 'baja_temporal', 'egresado'):
            db.query(StudentEnrollment).filter(
                StudentEnrollment.student_matricula == matricula
            ).delete()

            if inscripciones_borradas:
                log_audit_event(
                    db=db,
                    user_identifier=usuario_id,
                    action="DELETE",
                    entity_name="student_enrollments",
                    entity_id=matricula,
                    old_values={"grupos_inscritos": inscripciones_borradas},
                    new_values=None
                )
       

        if status_id_anterior != status_id or evidence_file_id is not None:
            nuevo_log = StudentStatusLog(
                student_matricula=alumno.matricula,
                changed_by_user=usuario_id or "Sistema Desconocido",
                previous_status_id=status_id_anterior,
                new_status_id=status_id,
                evidence_file_id=evidence_file_id
            )
            db.add(nuevo_log)

            log_audit_event(
                db=db,
                user_identifier=usuario_id,
                action="UPDATE",
                entity_name="students",
                entity_id=matricula,
                old_values=old_status_values,
                new_values={"status_id": status_id, "estatus_nombre": nuevo_estatus.name}
            )

        db.commit()
        return {"message": "Estatus y Log actualizados correctamente. Si aplicaba, se liberaron sus materias.", "nuevo_estatus": nuevo_estatus.name}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al actualizar estatus: {str(e)}")

@router.get("/{matricula}/ultimo-log-estatus")
def get_ultimo_log_estatus(matricula: str, db: Session = Depends(get_db)):
    log = db.query(StudentStatusLog).filter(
        StudentStatusLog.student_matricula == matricula
    ).order_by(StudentStatusLog.changed_at.desc()).first()

    if not log:
        return None

    return {
        "id": log.id,
        "previous_status": log.previous_status.name if log.previous_status else None,
        "new_status": log.new_status.name if log.new_status else None,
        "changed_by_user": log.changed_by_user,
        "changed_at": str(log.changed_at),
        "evidence_file_id": log.evidence_file_id,
        "evidence_file_name": log.evidence_file.file_name if log.evidence_file else None
    }

