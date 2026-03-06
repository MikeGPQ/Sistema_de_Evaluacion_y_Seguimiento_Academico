import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.enrollment import GuardarCargaRequest
from app.models.student import Student
from app.models.career import Career
from app.models.enrollment import StudentEnrollment 
from app.models.academic_group import AcademicGroup
from app.models.subject import Subject
from app.models.student_status import StudentStatus

router = APIRouter(prefix="/asignacion", tags=["Asignación de Horarios"])


#  ENVIAR GRUPOS Y CALCULAR CUPOS REALES

@router.get("/{matricula}/disponibles")
def obtener_grupos_disponibles(matricula: str, db: Session = Depends(get_db)):
    alumno = db.query(Student).filter(Student.matricula == matricula).first()
    if not alumno:
        raise HTTPException(status_code=404, detail="No existe un alumno.")
    
    #validacion de estado
    estatus_obj = db.query(StudentStatus).filter(StudentStatus.id == alumno.status_id).first()
    estado_alumno = estatus_obj.name.lower() if estatus_obj else "activo"
    
    if estado_alumno in ["baja", "baja_temporal", "egresado"]:
        raise HTTPException(
            status_code=403, 
            detail=f"El alumno se encuentra en estado '{estado_alumno.upper()}'. No se puede editar ni actualizar su horario hasta que vuelva a estar ACTIVO."
        )
        
    carrera = db.query(Career).filter(Career.id == alumno.career_id).first()
    nombre_carrera = carrera.name if carrera else "Sin carrera asignada"
    nombre_completo = f"{alumno.nombre} {alumno.apellido_paterno} {alumno.apellido_materno}"
    bloquear_grupo_base = alumno.cuatrimestre_actual > 1

    inscripciones_db = db.query(StudentEnrollment).filter(
        StudentEnrollment.student_matricula == matricula,
        StudentEnrollment.period_name == "2026-1"
    ).all()
    grupos_inscritos = [inscripcion.academic_group_id for inscripcion in inscripciones_db]

    grupos_db = db.query(AcademicGroup).filter(AcademicGroup.periodo == "2026-1").all()
    materias_dict = {}
    
    for grupo in grupos_db:
        materia = db.query(Subject).filter(Subject.id == grupo.subject_id).first()
        if not materia: continue
            
        if materia.id not in materias_dict:
            materias_dict[materia.id] = {
                "subject_id": materia.id, "nombre": materia.nombre, 
                "tipo": "Carrera", "grupos_disponibles": []
            }
            
        # calculo para cupos 
        # Contamos cuántos alumnos ya están inscritos en este grupo en la BD
        alumnos_inscritos = db.query(StudentEnrollment).filter(
            StudentEnrollment.academic_group_id == grupo.id,
            StudentEnrollment.period_name == "2026-1"
        ).count()
        
        cupos_libres = grupo.cupo_maximo - alumnos_inscritos
        if cupos_libres < 0: cupos_libres = 0

       
        horario_texto = "Horario por definir"
        try:
            h_data = grupo.horario_json
            if isinstance(h_data, str): h_data = json.loads(h_data)
            
            if isinstance(h_data, list) and len(h_data) > 0:
                horarios_formateados = [f"{h.get('dia', '')} {h.get('inicio', '')}-{h.get('fin', '')}" for h in h_data]
                horario_texto = " y ".join(horarios_formateados) 
            elif isinstance(h_data, dict):
                k, v = list(h_data.items())[0]
                horario_texto = f"{k.capitalize()} {v}"
        except Exception:
            pass

        materias_dict[materia.id]["grupos_disponibles"].append({
            "group_id": grupo.id,
            "nombre": grupo.identificador_grupo,  
            "cupo_disponible": cupos_libres, 
            "horario": horario_texto
        })

    return {
        "alumno_matricula": alumno.matricula, "alumno_nombre": nombre_completo.strip().upper(),
        "alumno_cuatrimestre": alumno.cuatrimestre_actual, "carrera": nombre_carrera,
        "grupo_base_bloqueado": bloquear_grupo_base, "grupo_base": "2A" if bloquear_grupo_base else None,
        "grupos_inscritos": grupos_inscritos, "materias_regulares": list(materias_dict.values()),
        "materias_recursamiento": [] 
    }


#  VALIDACIONES AL GUARDAR 

@router.post("/{matricula}/guardar")
def guardar_carga_academica(matricula: str, request: GuardarCargaRequest, db: Session = Depends(get_db)):
    grupos_seleccionados = [m.group_id for m in request.materias]
    
    # Traemos los datos reales de los grupos que el alumno quiere meter
    grupos_a_inscribir = db.query(AcademicGroup).filter(AcademicGroup.id.in_(grupos_seleccionados)).all()
    
    # VALIDACIÓN DE CUPO LLENO (Seguridad Backend) 
    for grupo in grupos_a_inscribir:
        inscritos = db.query(StudentEnrollment).filter(
            StudentEnrollment.academic_group_id == grupo.id,
            StudentEnrollment.period_name == "2026-1"
        ).count()
        
        # Verificamos si el alumno ya estaba en este grupo para no contar su propio lugar
        ya_estaba_inscrito = db.query(StudentEnrollment).filter(
            StudentEnrollment.academic_group_id == grupo.id,
            StudentEnrollment.student_matricula == matricula
        ).first()
        
        if not ya_estaba_inscrito and inscritos >= grupo.cupo_maximo:
            raise HTTPException(status_code=400, detail=f"El grupo '{grupo.identificador_grupo}' ya está lleno.")

    
    # VALIDACIÓN DE CHOQUE DE HORARIOS
    horarios_ocupados = [] # Aquí guardaremos los días, horas y nombres de materias
    
    for grupo in grupos_a_inscribir:
        try:
            h_data = grupo.horario_json
            if isinstance(h_data, str): h_data = json.loads(h_data)
            
            # Obtenemos el nombre real de la materia gracias a tu relationship() en SQLAlchemy
            nombre_materia_actual = grupo.subject.nombre if grupo.subject else f"Grupo {grupo.identificador_grupo}"

            if isinstance(h_data, list):
                for h in h_data:
                    dia_actual = h.get('dia', '')
                    inicio_actual = h.get('inicio', '')
                    fin_actual = h.get('fin', '')

                    # Comparamos cada clase nueva con las que ya escaneamos
                    for o in horarios_ocupados:
                        # Si es el mismo día...
                        if o['dia'].lower() == dia_actual.lower():
                            # Comprobamos si las horas se cruzan
                            if not (fin_actual <= o['inicio'] or inicio_actual >= o['fin']):
                                
                                mensaje_error = (
                                    f"El {dia_actual.capitalize()} tienes un choque de horarios: "
                                    f"'{nombre_materia_actual}' ({inicio_actual} a {fin_actual}) "
                                    f"choca con '{o['materia']}' ({o['inicio']} a {o['fin']})."
                                )
                                raise HTTPException(status_code=400, detail=mensaje_error)
                    
                    # Si no chocó, lo agregamos a la lista de horas ocupadas
                    horarios_ocupados.append({
                        'dia': dia_actual, 
                        'inicio': inicio_actual,
                        'fin': fin_actual, 
                        'grupo': grupo.identificador_grupo,
                        'materia': nombre_materia_actual # Guardamos el nombre para futuras comparaciones
                    })
        except HTTPException as he:
            raise he 
        except Exception:
            pass 

    #  GUARDADO REAL EN LA BASE DE DATOS 
    try:
        db.query(StudentEnrollment).filter(
            StudentEnrollment.student_matricula == matricula,
            StudentEnrollment.period_name == "2026-1"
        ).delete()

        for materia in request.materias:
            nueva_inscripcion = StudentEnrollment(
                student_matricula=matricula,
                academic_group_id=materia.group_id, 
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
# Endpoint para buscar predictivamente al alumno
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