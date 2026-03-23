import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.database import get_db
from datetime import datetime
from app.models.teacher import Teacher
from app.models.academic_group import AcademicGroup
from app.models.academic_period import AcademicPeriod
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/reportes", tags=["Generación de Actas"])

@router.get("/docentes/{docente_matricula}/grupos")
def obtener_grupos_docente(docente_matricula: str, db: Session = Depends(get_db)):
    docente = db.query(Teacher).filter(Teacher.matricula_empleado == docente_matricula).first()
    if not docente:
        raise HTTPException(status_code=404, detail="Docente no encontrado.")

    periodo_activo = db.query(AcademicPeriod).filter(AcademicPeriod.is_active == True).first()
    if not periodo_activo:
        return []

    grupos = db.query(AcademicGroup).filter(
        AcademicGroup.teacher_id == docente.id,
        AcademicGroup.period_id == periodo_activo.id
    ).all()

    return [{
        "id": g.id,
        "materia_nombre": g.subject.nombre,
        "identificador": g.identificador_grupo,
        "acta_status": g.acta_status,
        "total_alumnos": len(g.enrollments)
    } for g in grupos]

@router.get("/actas/{grupo_id}/validar")
def validar_acta_grupo(grupo_id: int, db: Session = Depends(get_db)):
    grupo = db.query(AcademicGroup).filter(AcademicGroup.id == grupo_id).first()
    if not grupo:
        raise HTTPException(status_code=404, detail="Grupo no encontrado.")

    alumnos_data = []
    total_calificados = 0
    
    enrollments = sorted(grupo.enrollments, key=lambda x: x.student.apellido_paterno)

    for enr in enrollments:
        calif = enr.calificacion_final
        if calif is not None:
            total_calificados += 1
        
        alumnos_data.append({
            "matricula": enr.student_matricula,
            "nombre": f"{enr.student.apellido_paterno} {enr.student.apellido_materno}, {enr.student.nombre}",
            "calificacion_final": calif
        })

    total_inscritos = len(enrollments)
    captura_completa = (total_inscritos > 0 and total_inscritos == total_calificados)

    return {
        "carrera": grupo.subject.career.name if grupo.subject.career else "Tronco Común",
        "nivel": grupo.subject.nivel_academico,
        "codigo_materia": grupo.subject.codigo_unico or f"MAT-{grupo.subject_id}",
        "campus": "San Francisco - Campeche",
        "cuatrimestre": grupo.subject.quarter.nombre if grupo.subject.quarter else "N/A",
        "periodo": grupo.period.period_name,
        "grupo": grupo.identificador_grupo,
        "materia_nombre": grupo.subject.nombre,
        "docente_nombre": f"{grupo.teacher.nombre} {grupo.teacher.apellido_paterno}",
        "acta_status": grupo.acta_status,
        "captura_completa": captura_completa,
        "alumnos": alumnos_data
    }

@router.post("/actas/{grupo_id}/cerrar")
def cerrar_acta_oficial(grupo_id: int, payload: dict, db: Session = Depends(get_db)):
    usuario_id = payload.get("usuario_id", "Sistema")
    
    grupo = db.query(AcademicGroup).filter(AcademicGroup.id == grupo_id).first()
    if not grupo:
        raise HTTPException(status_code=404, detail="Grupo no encontrado.")
    
    if grupo.acta_status == 'cerrada':
        raise HTTPException(status_code=400, detail="El acta ya se encuentra cerrada.")

    inscritos = len(grupo.enrollments)
    calificados = sum(1 for e in grupo.enrollments if e.calificacion_final is not None)
    
    if inscritos == 0 or inscritos != calificados:
        raise HTTPException(status_code=400, detail="No se puede cerrar el acta: faltan alumnos por calificar.")

    try:
        old_status = grupo.acta_status
        grupo.acta_status = 'cerrada'
        
        log_audit_event(
            db=db,
            user_identifier=usuario_id,
            action="UPDATE",
            entity_name="academic_groups",
            entity_id=str(grupo_id),
            old_values={"acta_status": old_status},
            new_values={"acta_status": "cerrada", "motivo": "Cierre oficial de acta"}
        )

        db.commit()
        return {"message": "Acta cerrada exitosamente. Calificaciones protegidas."}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))