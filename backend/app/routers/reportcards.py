import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.database import get_db
from datetime import datetime

router = APIRouter(tags=["Generación de Actas"])

# =================================================================
# Grupos academicos activos por docente
# =================================================================
@router.get("/docentes/{docente_id}/grupos")
def obtener_grupos_docente(docente_id: str, db: Session = Depends(get_db)):
    
    # Buscamos al maestro por su external_id 
    query_docente = text("SELECT id FROM teachers WHERE external_id = :docente_id")
    docente = db.execute(query_docente, {"docente_id": docente_id}).mappings().first()
    
    if not docente:
        # si no se encuentra por su external_id lo intentamos buscar por su ID 
        try:
            query_fallback = text("SELECT id FROM teachers WHERE id = :id")
            docente = db.execute(query_fallback, {"id": int(docente_id)}).mappings().first()
        except ValueError:
            pass
            
    if not docente:
        raise HTTPException(status_code=404, detail="Docente no encontrado en la base de datos.")

    # obtenemos los grupos academicos activos del docente para el periodo actual
    query_grupos = text("""
        SELECT 
            g.id, 
            s.nombre AS materia_nombre, 
            g.identificador_grupo AS identificador, 
            g.acta_status,
            (SELECT COUNT(*) FROM student_enrollments WHERE academic_group_id = g.id) AS total_alumnos
        FROM academic_groups g
        JOIN subjects s ON g.subject_id = s.id
        WHERE g.teacher_id = :teacher_id AND g.periodo = (SELECT period_name FROM academic_periods WHERE is_active = TRUE LIMIT 1)
    """)
    
    grupos = db.execute(query_grupos, {"teacher_id": docente.id}).mappings().all()
    return [dict(g) for g in grupos]


# =================================================================
# endpoint para validar el acta de un grupo academico antes de generar la acta oficial
# =================================================================
@router.get("/actas/{grupo_id}/validar")
def validar_acta_grupo(grupo_id: int, db: Session = Depends(get_db)):
    query_header = text("""
        SELECT 
            c.name AS carrera,
            s.id AS codigo_materia,
            'San Francisco - Campeche' AS campus,
            s.cuatrimestre,
            g.periodo,
            g.identificador_grupo AS grupo,
            s.nombre AS materia_nombre,
            CONCAT(t.nombre, ' ', t.apellido_paterno) AS docente_nombre,
            g.acta_status
        FROM academic_groups g
        JOIN subjects s ON g.subject_id = s.id
        LEFT JOIN careers c ON s.career_id = c.id
        JOIN teachers t ON g.teacher_id = t.id
        WHERE g.id = :grupo_id
    """)
    header = db.execute(query_header, {"grupo_id": grupo_id}).mappings().first()
    
    if not header:
        raise HTTPException(status_code=404, detail="Grupo académico no encontrado.")

    query_alumnos = text("""
        SELECT 
            st.matricula,
            CONCAT(st.apellido_paterno, ' ', st.apellido_materno, ', ', st.nombre) AS nombre,
            se.calificacion_final 
        FROM student_enrollments se
        JOIN students st ON se.student_matricula = st.matricula
        WHERE se.academic_group_id = :grupo_id
        ORDER BY st.apellido_paterno ASC
    """)
    alumnos_db = db.execute(query_alumnos, {"grupo_id": grupo_id}).mappings().all()
    alumnos = [dict(a) for a in alumnos_db]

    total_inscritos = len(alumnos)
    total_calificados = sum(1 for a in alumnos if a['calificacion_final'] is not None)
    
    captura_completa = False
    if total_inscritos > 0 and total_inscritos == total_calificados:
        captura_completa = True

    return {
        "carrera": header['carrera'] or "Tronco Común",
        "codigo_materia": f"MAT-{header['codigo_materia']}",
        "campus": header['campus'],
        "cuatrimestre": header['cuatrimestre'],
        "periodo": header['periodo'],
        "grupo": header['grupo'],
        "materia_nombre": header['materia_nombre'],
        "docente_nombre": header['docente_nombre'],
        "acta_status": header['acta_status'],
        "captura_completa": captura_completa,
        "alumnos": alumnos
    }


# =================================================================
# endpoint para cerrar el acta oficial de un grupo academico, bloqueando futuras modificaciones a las calificaciones
# =================================================================
@router.post("/actas/{grupo_id}/cerrar")
def cerrar_acta_oficial(grupo_id: int, payload: dict, db: Session = Depends(get_db)):
    docente_id = payload.get("docente_id", "Desconocido")
    
    grupo = db.execute(text("SELECT acta_status FROM academic_groups WHERE id = :grupo_id"), {"grupo_id": grupo_id}).mappings().first()
    if not grupo:
        raise HTTPException(status_code=404, detail="Grupo no encontrado.")
    if grupo['acta_status'] == 'cerrada':
        raise HTTPException(status_code=400, detail="El acta ya se encuentra cerrada y congelada.")

    try:
        # Actualizamos el estado del acta a cerrados
        db.execute(
            text("UPDATE academic_groups SET acta_status = 'cerrada' WHERE id = :grupo_id"),
            {"grupo_id": grupo_id}
        )
        
        # añadimos un registro al log
        try:
            db.execute(
                text("""
                    INSERT INTO audit_logs 
                    (user_identifier, action, entity_name, entity_id, old_values, new_values, created_at) 
                    VALUES (:user_id, :action, :entity_name, :entity_id, :old_vals, :new_vals, :fecha)
                """),
                {
                    "user_id": str(docente_id), 
                    "action": "UPDATE",
                    "entity_name": "academic_groups",
                    "entity_id": grupo_id,
                    "old_vals": json.dumps({"acta_status": grupo['acta_status']}),
                    "new_vals": json.dumps({"acta_status": "cerrada"}),
                    "fecha": datetime.now()
                }
            )
        except Exception as log_error:
            print(f"Advertencia: No se pudo escribir el log de auditoría. Detalle: {log_error}")

        db.commit()
        return {"message": "Acta cerrada exitosamente. Las calificaciones han sido congeladas."}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Fallo crítico al cerrar el acta: {str(e)}")