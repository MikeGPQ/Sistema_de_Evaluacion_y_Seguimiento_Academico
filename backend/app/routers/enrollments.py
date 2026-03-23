from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_ 
from typing import List

from app.db.database import get_db
from app.schemas.enrollment import GuardarCargaRequest
from app.models.student import Student
from app.models.student_academic_profile import StudentAcademicProfile
from app.models.academic_program import AcademicProgram
from app.models.enrollment import StudentEnrollment 
from app.models.academic_group import AcademicGroup
from app.models.subject import Subject
from app.models.student_status import StudentStatus
from app.models.academic_period import AcademicPeriod
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/asignacion", tags=["Asignación de Horarios"])

def time_to_minutes(time_obj):
    if not time_obj: return 0
    return time_obj.hour * 60 + time_obj.minute

@router.get("/{matricula}/disponibles")
def obtener_grupos_disponibles(matricula: str, profile_id: int, db: Session = Depends(get_db)):
    perfil = db.query(StudentAcademicProfile).filter(
        StudentAcademicProfile.id == profile_id,
        StudentAcademicProfile.student_matricula == matricula
    ).first()
    
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil académico no encontrado para esta matrícula.")
    
    if perfil.status.name.lower() in ["baja", "baja_temporal", "egresado"]:
        raise HTTPException(
            status_code=403, 
            detail=f"El alumno está en estado '{perfil.status.name.upper()}'. No se permiten inscripciones."
        )

    materias_db = db.query(Subject).filter(
        Subject.quarter_id == perfil.quarter_actual_id,
        or_(Subject.career_id == perfil.career_id, Subject.career_id.is_(None))
    ).all()

    materias_dict = {}
    for materia in materias_db:
        grupos = db.query(AcademicGroup).filter(
            AcademicGroup.subject_id == materia.id,
            AcademicGroup.period_id == perfil.period_id
        ).all()

        grupos_lista = []
        for g in grupos:
            inscritos = db.query(StudentEnrollment).filter(StudentEnrollment.academic_group_id == g.id).count()
            cupos_libres = max(0, (materia.cupo_maximo or 30) - inscritos)

            horarios_fmt = [f"{s.dia_semana} {s.hora_inicio}-{s.hora_fin}" for s in g.schedules]
            
            grupos_lista.append({
                "group_id": g.id,
                "nombre": g.identificador_grupo,
                "cupo_disponible": cupos_libres,
                "horario": " | ".join(horarios_fmt) if horarios_fmt else "Sin horario",
                "schedules": g.schedules
            })

        materias_dict[materia.id] = {
            "subject_id": materia.id,
            "nombre": materia.nombre,
            "tipo": "Tronco Común" if not materia.career_id else "Carrera",
            "grupos_disponibles": grupos_lista
        }

    return {
        "alumno_matricula": matricula,
        "perfil_id": perfil.id,
        "programa": perfil.career.name,
        "cuatrimestre": perfil.quarter_actual.nombre,
        "materias_regulares": list(materias_dict.values())
    }

@router.post("/{matricula}/guardar")
def guardar_carga_academica(matricula: str, request: GuardarCargaRequest, db: Session = Depends(get_db)):
    grupos_ids = [m.group_id for m in request.materias]
    grupos_db = db.query(AcademicGroup).filter(AcademicGroup.id.in_(grupos_ids)).all()
    
    horarios_ocupados = []
    for g in grupos_db:
        for s in g.schedules:
            ini_a = time_to_minutes(s.hora_inicio)
            fin_a = time_to_minutes(s.hora_fin)
            
            for o in horarios_ocupados:
                if o['dia'] == s.dia_semana:
                    if not (fin_a <= o['ini'] or ini_a >= o['fin']):
                        raise HTTPException(
                            status_code=400, 
                            detail=f"Cruce de horario: {g.subject.nombre} choca con {o['materia']}"
                        )
            
            horarios_ocupados.append({
                'dia': s.dia_semana, 'ini': ini_a, 'fin': fin_a, 'materia': g.subject.nombre
            })

    try:
        db.query(StudentEnrollment).filter(
            StudentEnrollment.student_matricula == matricula,
            StudentEnrollment.academic_profile_id == request.profile_id
        ).delete()

        for m in request.materias:
            nueva = StudentEnrollment(
                student_matricula=matricula,
                academic_profile_id=request.profile_id,
                academic_group_id=m.group_id,
                is_retake=m.is_retake
            )
            db.add(nueva)
        
        log_audit_event(db, request.usuario_id, "UPDATE", "enrollments", matricula, None, {"materias": len(request.materias)})
        db.commit()
        return {"message": "Carga académica guardada exitosamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))