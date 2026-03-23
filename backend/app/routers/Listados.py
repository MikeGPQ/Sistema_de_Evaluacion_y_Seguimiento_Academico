from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from pydantic import BaseModel
from typing import List, Optional

from app.db.database import get_db
from app.models.student import Student
from app.models.student_academic_profile import StudentAcademicProfile
from app.models.student_status import StudentStatus
from app.models.academic_program import AcademicProgram
from app.models.student_status_log import StudentStatusLog
from app.models.file import File as FileModel
from app.models.enrollment import StudentEnrollment
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/alumnos", tags=["Alumnos"])

@router.get("/listado")
def listar_alumnos(
    skip: int = 0,
    limit: int = 10,
    busqueda: Optional[str] = None,
    nivel_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(StudentAcademicProfile).join(Student).join(AcademicProgram).join(StudentStatus)

    if busqueda:
        termino = f"%{busqueda}%"
        query = query.filter(or_(
            Student.matricula.ilike(termino),
            Student.nombre.ilike(termino),
            Student.apellido_paterno.ilike(termino)
        ))
    
    if nivel_id:
        query = query.filter(StudentAcademicProfile.nivel_id == nivel_id)

    total = query.count()
    perfiles = query.offset(skip).limit(limit).all()

    data = []
    for p in perfiles:
        data.append({
            "profile_id": p.id,
            "matricula": p.student_matricula,
            "nombre_completo": f"{p.student.nombre} {p.student.apellido_paterno} {p.student.apellido_materno}".strip(),
            "carrera": p.career.name,
            "nivel": p.nivel.name,
            "estatus": p.status.name,
            "cuatrimestre": p.quarter_actual.nombre
        })

    return {"total": total, "data": data}

@router.put("/perfil/{profile_id}/estatus")
def cambiar_estatus_perfil(
    profile_id: int,
    status_id: int = Form(...),
    usuario_id: str = Form("Sistema"),
    evidence_file: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    perfil = db.query(StudentAcademicProfile).filter(StudentAcademicProfile.id == profile_id).first()
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil académico no encontrado")

    nuevo_estatus = db.query(StudentStatus).filter(StudentStatus.id == status_id).first()
    
    if nuevo_estatus.name.lower() in ('baja', 'baja_temporal') and not evidence_file:
        raise HTTPException(status_code=400, detail="Se requiere evidencia digital para procesar una baja.")

    try:
        file_id = None
        if evidence_file:
            content = evidence_file.file.read()
            nuevo_archivo = FileModel(
                filename=evidence_file.filename,
                mime_type=evidence_file.content_type,
                file_content=content
            )
            db.add(nuevo_archivo)
            db.flush()
            file_id = nuevo_archivo.id

        log_status = StudentStatusLog(
            academic_profile_id=perfil.id,
            student_matricula=perfil.student_matricula,
            previous_status_id=perfil.status_id,
            new_status_id=status_id,
            changed_by_user=usuario_id,
            evidence_file_id=file_id
        )
        db.add(log_status)

        if nuevo_estatus.name.lower() in ('baja', 'baja_temporal', 'egresado'):
            db.query(StudentEnrollment).filter(
                StudentEnrollment.academic_profile_id == perfil.id
            ).delete()

        perfil.status_id = status_id
        
        db.commit()
        return {"message": "Estatus actualizado con éxito", "perfil_id": profile_id}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/perfil/{profile_id}/historial-estatus")
def obtener_historial_estatus(profile_id: int, db: Session = Depends(get_db)):
    logs = db.query(StudentStatusLog).filter(
        StudentStatusLog.academic_profile_id == profile_id
    ).order_by(StudentStatusLog.changed_at.desc()).all()

    return [{
        "fecha": l.changed_at,
        "anterior": l.previous_status.name if l.previous_status else "N/A",
        "nuevo": l.new_status.name,
        "usuario": l.changed_by_user,
        "archivo_id": l.evidence_file_id
    } for l in logs]