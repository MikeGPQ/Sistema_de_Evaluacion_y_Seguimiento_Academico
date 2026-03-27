from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

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
    busqueda: str = None,
    carrera_id: int = None,
    cuatrimestre: int = None,
    db: Session = Depends(get_db)
):
    from app.models.quarter_catalog import QuarterCatalog

    query = db.query(Student)

    if busqueda:
        termino = f"%{busqueda}%"
        query = query.filter(
            (Student.matricula.ilike(termino)) |
            (Student.nombre.ilike(termino)) |
            (Student.apellido_paterno.ilike(termino)) |
            (Student.apellido_materno.ilike(termino))
        )

    if carrera_id or cuatrimestre:
        profile_query = db.query(StudentAcademicProfile.student_matricula)
        if carrera_id:
            profile_query = profile_query.filter(StudentAcademicProfile.career_id == carrera_id)
        if cuatrimestre:
            profile_query = profile_query.join(
                QuarterCatalog, StudentAcademicProfile.quarter_actual_id == QuarterCatalog.id
            ).filter(QuarterCatalog.external_id == cuatrimestre)
        matriculas_filtradas = [r[0] for r in profile_query.distinct().all()]
        query = query.filter(Student.matricula.in_(matriculas_filtradas))

    total = query.count()
    alumnos_db = query.offset(skip).limit(limit).all()

    data = []
    for alumno in alumnos_db:
        perfil_reciente = db.query(StudentAcademicProfile).filter(
            StudentAcademicProfile.student_matricula == alumno.matricula
        ).order_by(StudentAcademicProfile.id.desc()).first()

        carrera_nombre = "Sin Carrera"
        estatus_nombre = "Sin Estatus"

        if perfil_reciente:
            if perfil_reciente.academic_program:
                carrera_nombre = perfil_reciente.academic_program.name
            if perfil_reciente.status:
                estatus_nombre = perfil_reciente.status.name

        nombre_completo = f"{alumno.nombre} {alumno.apellido_paterno} {alumno.apellido_materno or ''}".strip()

        data.append({
            "matricula": alumno.matricula,
            "nombre_completo": nombre_completo or "Sin Nombre",
            "carrera": carrera_nombre,
            "estatus": estatus_nombre
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

    perfil = db.query(StudentAcademicProfile).filter(
        StudentAcademicProfile.student_matricula == matricula
    ).order_by(StudentAcademicProfile.id.desc()).first()

    if not perfil:
        raise HTTPException(status_code=404, detail="El alumno no tiene un perfil académico activo")

    nuevo_estatus = db.query(StudentStatus).filter(StudentStatus.id == status_id).first()
    if not nuevo_estatus:
        raise HTTPException(status_code=400, detail="Estatus no válido")

    if nuevo_estatus.name in ('baja', 'baja_temporal') and not evidence_file:
        estatus_actual = db.query(StudentStatus).filter(StudentStatus.id == perfil.status_id).first()
        estatus_actual_es_baja = estatus_actual and estatus_actual.name in ('baja', 'baja_temporal')
        log_con_evidencia = db.query(StudentStatusLog).filter(
            StudentStatusLog.academic_profile_id == perfil.id,
            StudentStatusLog.evidence_file_id != None
        ).order_by(StudentStatusLog.id.desc()).first()
        if not (estatus_actual_es_baja and log_con_evidencia):
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

        old_status_values = {"status_id": perfil.status_id}
        status_id_anterior = perfil.status_id
        
        perfil.status_id = status_id

        inscripciones_borradas = []
        if nuevo_estatus.name in ('baja', 'baja_temporal', 'egresado'):
            inscripciones_viejas = db.query(StudentEnrollment).filter(
                StudentEnrollment.academic_profile_id == perfil.id
            ).all()
            inscripciones_borradas = [insc.academic_group_id for insc in inscripciones_viejas]

            db.query(StudentEnrollment).filter(
                StudentEnrollment.academic_profile_id == perfil.id
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
                academic_profile_id=perfil.id,
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
                entity_name="student_academic_profiles",
                entity_id=matricula, 
                old_values=None,   
                new_values={
                    "evento": f"El estatus del alumno {matricula} cambió a: {nuevo_estatus.name.replace('_', ' ').capitalize()}"
                }
            )

        db.commit()
        return {"message": "Estatus y Log actualizados correctamente. Si aplicaba, se liberaron sus materias.", "nuevo_estatus": nuevo_estatus.name}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al actualizar estatus: {str(e)}")

@router.get("/{matricula}/ultimo-log-estatus")
def get_ultimo_log_estatus(matricula: str, db: Session = Depends(get_db)):
    perfil = db.query(StudentAcademicProfile).filter(
        StudentAcademicProfile.student_matricula == matricula
    ).order_by(StudentAcademicProfile.id.desc()).first()

    if not perfil:
        return None

    log = db.query(StudentStatusLog).filter(
        StudentStatusLog.academic_profile_id == perfil.id,
        StudentStatusLog.evidence_file_id != None
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