from sqlalchemy.orm import Session
from sqlalchemy import func, case
from app.models.enrollment import StudentEnrollment
from app.models.academic_group import AcademicGroup
from app.models.student_academic_profile import StudentAcademicProfile
from app.services.audit_service import log_audit_event

# funcion asincrona que evalua si un alumno ha completado el 100% de sus actas para promoverlo
def procesar_promocion_automatica(grupo_id: int, db: Session):
    try:
        # obtiene los perfiles unicos de los alumnos inscritos en el grupo recien cerrado
        inscripciones = db.query(StudentEnrollment.academic_profile_id, StudentEnrollment.student_matricula).filter(
            StudentEnrollment.academic_group_id == grupo_id
        ).distinct().all()

        for insc in inscripciones:
            perfil_id = insc.academic_profile_id
            matricula = insc.student_matricula

            # calcula con orm el total de materias inscritas contra el total de actas cerradas
            conteo = db.query(
                func.count(StudentEnrollment.id).label("total_inscritas"),
                func.sum(case((AcademicGroup.estatus_acta == 'CERRADA', 1), else_=0)).label("total_cerradas")
            ).join(AcademicGroup, StudentEnrollment.academic_group_id == AcademicGroup.id).filter(
                StudentEnrollment.academic_profile_id == perfil_id
            ).first()

            total_inscritas = conteo.total_inscritas or 0
            total_cerradas = conteo.total_cerradas or 0

            # validacion donde las mismas materias deben coincidir con las actas cerradas
            if total_inscritas > 0 and total_inscritas == total_cerradas:
                perfil = db.query(StudentAcademicProfile).filter(StudentAcademicProfile.id == perfil_id).first()
                
                if perfil:
                    old_quarter = perfil.quarter_actual_id
                    
                    # incrementa el cuatrimestre del alumno de forma automatica
                    perfil.quarter_actual_id += 1
                    
                    # registro de la promocion en logs
                    log_audit_event(
                        db=db,
                        user_identifier="SISTEMA_AUTOMATICO",
                        action="UPDATE",
                        entity_name="student_academic_profiles",
                        entity_id=str(matricula),
                        old_values={"quarter_actual_id": old_quarter},
                        new_values={"quarter_actual_id": perfil.quarter_actual_id}
                    )

        # guarda todos los cambios de promocion evaluados en la base de datos
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error en promocion automatica: {e}")