from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db

from app.schemas.enrollment import GuardarCargaRequest
from app.models.student import Student
from app.models.career import Career
from app.models.enrollment import StudentEnrollment 

router = APIRouter(prefix="/asignacion", tags=["Asignación de Horarios"])

@router.get("/{matricula}/disponibles")
def obtener_grupos_disponibles(matricula: str, db: Session = Depends(get_db)):
    #  BUSCAMOS AL ALUMNO REAL
    alumno = db.query(Student).filter(Student.matricula == matricula).first()
    if not alumno:
        raise HTTPException(status_code=404, detail="No existe un alumno con esta matrícula en el sistema.")
        
    carrera = db.query(Career).filter(Career.id == alumno.career_id).first()
    nombre_carrera = carrera.name if carrera else "Sin carrera asignada"
    nombre_completo = f"{alumno.nombre} {alumno.apellido_paterno} {alumno.apellido_materno}"
    bloquear_grupo_base = alumno.cuatrimestre_actual > 1

    
    # LEEMOS LAS INSCRIPCIONES REALES DE LA BASE DE DATOS
    
    inscripciones_db = db.query(StudentEnrollment).filter(
        StudentEnrollment.student_matricula == matricula,
        StudentEnrollment.period_name == "2026-1"
    ).all()
    # Extraemos solo los IDs de los grupos en los que ya está inscrito
    grupos_inscritos = [inscripcion.academic_group_id for inscripcion in inscripciones_db]

    return {
        "alumno_matricula": alumno.matricula,
        "alumno_nombre": nombre_completo.strip().upper(),
        "alumno_cuatrimestre": alumno.cuatrimestre_actual,
        "carrera": nombre_carrera,
        "grupo_base_bloqueado": bloquear_grupo_base,
        "grupo_base": "2A" if bloquear_grupo_base else None,
        
        # Mandamos los IDs que encontramos en la BD al Frontend
        "grupos_inscritos": grupos_inscritos, 
        
        # MOCK DEL CATÁLOGO 
        "materias_regulares": [
            {
                "subject_id": 201,
                "nombre": "Programación Orientada a Objetos",
                "tipo": "Carrera",
                "grupos_disponibles": [
                    {"group_id": 1, "nombre": "2A", "cupo_disponible": 15, "horario": "Lunes 08:00 - 10:00"},
                    {"group_id": 2, "nombre": "2B", "cupo_disponible": 0, "horario": "Martes 10:00 - 12:00"} 
                ]
            },
            {
                "subject_id": 105,
                "nombre": "Ética Profesional",
                "tipo": "Tronco Común",
                "grupos_disponibles": [
                    {"group_id": 3, "nombre": "TC-A", "cupo_disponible": 30, "horario": "Miércoles 08:00 - 10:00"}
                ]
            }
        ],
        "materias_recursamiento": [
            {
                "subject_id": 101,
                "nombre": "Álgebra Lineal (Reprobada)",
                "tipo": "Recursamiento",
                "grupos_disponibles": [
                    {"group_id": 4, "nombre": "1C", "cupo_disponible": 5, "horario": "Lunes 08:00 - 10:00"} 
                ]
            }
        ]
    }

@router.post("/{matricula}/guardar")
def guardar_carga_academica(matricula: str, request: GuardarCargaRequest, db: Session = Depends(get_db)):
    
    grupos_seleccionados = [m.group_id for m in request.materias]

    # Validaciones mockeadas usando los nuevos IDs numéricos
    if 2 in grupos_seleccionados: #  2 es el ID falso del grupo 2B
        raise HTTPException(status_code=400, detail="El grupo '2B' para Programación ya no tiene cupo disponible.")
            
    if 1 in grupos_seleccionados and 4 in grupos_seleccionados: # 1 y 4 chocan en Lunes a las 08:00
        raise HTTPException(status_code=400, detail="Choque de horario detectado: 'POO' (Lunes 08:00) choca con 'Álgebra Lineal' (Lunes 08:00).")

    #  GUARDADO REAL EN LA BASE DE DATOS
    try:
        # Borramos carga anterior si existe (evitar duplicados)
        db.query(StudentEnrollment).filter(
            StudentEnrollment.student_matricula == matricula,
            StudentEnrollment.period_name == "2026-1"
        ).delete()

        # Insertamos las materias seleccionadas reales
        for materia in request.materias:
            nueva_inscripcion = StudentEnrollment(
                student_matricula=matricula,
                academic_group_id=materia.group_id, # Mandamos el ID numérico
                period_name="2026-1",
                is_retake=materia.is_retake
            )
            db.add(nueva_inscripcion)
        
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en BD: {str(e)}")
        
    return {
        "message": "¡Carga académica guardada exitosamente en la Base de Datos!",
        "materias_inscritas": len(request.materias)
    }
 #Enpoint para buscar predictivamente al alumno al escribir su matricula
@router.get("/buscar-alumno")
def buscar_alumno_autocomplete(q: str, db: Session = Depends(get_db)):
    if not q or len(q) < 3: 
        return []
    
    
    alumnos = db.query(Student).filter(Student.matricula.like(f"{q}%")).limit(5).all()
    
    resultados = []
    for a in alumnos:
        resultados.append({
            "matricula": a.matricula,
            "nombre": f"{a.nombre} {a.apellido_paterno} {a.apellido_materno}".strip()
        })
    return resultados