import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from datetime import datetime

from app.models.academic_group import AcademicGroup
from app.models.academic_period import AcademicPeriod
from app.models.teacher import Teacher
from app.models.subject import Subject
from app.models.academic_program import AcademicProgram
from app.models.enrollment import StudentEnrollment
from app.models.student import Student
from app.models.student_period_gpa import StudentPeriodGpa
from app.services.audit_service import log_audit_event
from sqlalchemy import func, case

router = APIRouter(tags=["Generación de Actas"])

@router.get("/docentes/{docente_id}/grupos")
def obtener_grupos_docente(docente_id: str, db: Session = Depends(get_db)):
    docente = db.query(Teacher).filter(Teacher.matricula_empleado == docente_id).first()
    
    if not docente:
        try:
            docente = db.query(Teacher).filter(Teacher.id == int(docente_id)).first()
        except ValueError:
            pass
            
    if not docente:
        raise HTTPException(status_code=404, detail="Docente no encontrado en la base de datos.")

    periodo_actual = db.query(AcademicPeriod).filter(AcademicPeriod.is_active == True).first()
    
    if not periodo_actual:
        return []

    grupos_db = db.query(AcademicGroup).filter(
        AcademicGroup.teacher_id == docente.id,
        AcademicGroup.period_id == periodo_actual.id
    ).all()

    resultados = []
    for g in grupos_db:
        total_alumnos = db.query(StudentEnrollment).filter(StudentEnrollment.academic_group_id == g.id).count()
        resultados.append({
            "id": g.id,
            "materia_nombre": g.subject.nombre if g.subject else "Sin Materia",
            "identificador": g.sigad_group.identificador if g.sigad_group else str(g.id),
            "acta_status": g.estatus_acta.lower() if g.estatus_acta else "abierta",
            "total_alumnos": total_alumnos
        })
        
    return resultados

@router.get("/actas/{grupo_id}/validar")
def validar_acta_grupo(grupo_id: int, db: Session = Depends(get_db)):
    grupo = db.query(AcademicGroup).filter(AcademicGroup.id == grupo_id).first()
    
    if not grupo:
        raise HTTPException(status_code=404, detail="Grupo académico no encontrado.")

    materia = grupo.subject
    docente = grupo.teacher
    programa = materia.career if materia else None
    periodo = grupo.period

    cuatrimestre_val = materia.quarter.external_id if materia and getattr(materia, 'quarter', None) else getattr(materia, 'quarter_id', 1)

    inscripciones = db.query(StudentEnrollment).filter(StudentEnrollment.academic_group_id == grupo_id).all()
    
    alumnos = []
    for insc in inscripciones:
        st = insc.student
        nombre_formateado = f"{st.apellido_paterno} {st.apellido_materno or ''}, {st.nombre}".strip() if st else "Desconocido"
        
        alumnos.append({
            "matricula": insc.student_matricula,
            "nombre": nombre_formateado,
            "calificacion_final": insc.calificacion_final
        })

    alumnos.sort(key=lambda x: x['nombre'])

    total_inscritos = len(alumnos)
    total_calificados = sum(1 for a in alumnos if a['calificacion_final'] is not None)
    
    captura_completa = False
    if total_inscritos > 0 and total_inscritos == total_calificados:
        captura_completa = True

    return {
        "carrera": programa.name if programa else "Tronco Común",
        "codigo_materia": f"MAT-{materia.id if materia else '000'}",
        "campus": "San Francisco - Campeche",
        "cuatrimestre": cuatrimestre_val,
        "periodo": periodo.codigo if periodo else "Desconocido",
        "grupo": grupo.sigad_group.identificador if grupo.sigad_group else str(grupo.id),
        "materia_nombre": materia.nombre if materia else "Sin Materia",
        "docente_nombre": f"{docente.nombre} {docente.apellido_paterno}" if docente else "Sin Docente",
        "acta_status": grupo.estatus_acta.lower() if grupo.estatus_acta else "abierta",
        "captura_completa": captura_completa,
        "alumnos": alumnos
    }

@router.post("/actas/{grupo_id}/cerrar")
def cerrar_acta_oficial(grupo_id: int, payload: dict, db: Session = Depends(get_db)):
    docente_id = payload.get("docente_id", "Desconocido")
    
    grupo = db.query(AcademicGroup).filter(AcademicGroup.id == grupo_id).first()
    
    if not grupo:
        raise HTTPException(status_code=404, detail="Grupo no encontrado.")
        
    if grupo.estatus_acta == 'CERRADA':
        raise HTTPException(status_code=400, detail="El acta ya se encuentra cerrada y congelada.")

    try:
        old_status = grupo.estatus_acta
        grupo.estatus_acta = 'CERRADA'

        log_audit_event(
            db=db,
            user_identifier=str(docente_id),
            action="UPDATE",
            entity_name="academic_groups",
            entity_id=str(grupo.id),
            old_values={"estatus_acta": old_status},
            new_values={"estatus_acta": "CERRADA"}
        )

        # Flush para que las queries siguientes vean estatus_acta = 'CERRADA'
        db.flush()

        # --- Recalcular GPA para los alumnos de este grupo en este periodo ---
        period_id = grupo.period_id
        profile_ids = [e.academic_profile_id for e in db.query(StudentEnrollment.academic_profile_id)
                       .filter(StudentEnrollment.academic_group_id == grupo_id).all()]

        for profile_id in set(profile_ids):
            resultado = (
                db.query(
                    func.round(func.avg(StudentEnrollment.calificacion_final), 2).label("gpa"),
                    func.count(StudentEnrollment.id).label("total"),
                    func.sum(case((StudentEnrollment.status == 'aprobada', 1), else_=0)).label("aprobadas"),
                    func.sum(case((StudentEnrollment.status == 'reprobada', 1), else_=0)).label("reprobadas"),
                )
                .join(AcademicGroup, StudentEnrollment.academic_group_id == AcademicGroup.id)
                .filter(
                    StudentEnrollment.academic_profile_id == profile_id,
                    StudentEnrollment.period_id == period_id,
                    AcademicGroup.estatus_acta == 'CERRADA',
                    StudentEnrollment.calificacion_final.isnot(None),
                )
                .first()
            )

            if not resultado or resultado.gpa is None:
                continue

            existing = db.query(StudentPeriodGpa).filter(
                StudentPeriodGpa.academic_profile_id == profile_id,
                StudentPeriodGpa.period_id == period_id,
            ).first()

            if existing:
                existing.gpa = float(resultado.gpa)
                existing.total_subjects = resultado.total
                existing.approved_subjects = int(resultado.aprobadas or 0)
                existing.failed_subjects = int(resultado.reprobadas or 0)
            else:
                db.add(StudentPeriodGpa(
                    academic_profile_id=profile_id,
                    period_id=period_id,
                    gpa=float(resultado.gpa),
                    total_subjects=resultado.total,
                    approved_subjects=int(resultado.aprobadas or 0),
                    failed_subjects=int(resultado.reprobadas or 0),
                ))

        db.commit()
        return {"message": "Acta cerrada exitosamente. Las calificaciones han sido congeladas."}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Fallo crítico al cerrar el acta: {str(e)}")