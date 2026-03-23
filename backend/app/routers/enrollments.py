import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, or_ 
from app.db.database import get_db
from app.schemas.enrollment import GuardarCargaRequest
from app.models.student import Student
from app.models.career import Career
from app.models.enrollment import StudentEnrollment 
from app.models.academic_group import AcademicGroup
from app.models.subject import Subject
from app.models.student_status import StudentStatus
from app.services.audit_service import log_audit_event


router = APIRouter(prefix="/asignacion", tags=["Asignación de Horarios"])

def time_to_minutes(time_str):
    try:
        h, m = map(int, time_str.replace(" ", "").split(':'))
        return h * 60 + m
    except:
        return 0

#endpoint para obtener grupos disponibles, con validaciones de estado del alumno 
@router.get("/{matricula}/disponibles")
def obtener_grupos_disponibles(matricula: str, db: Session = Depends(get_db)):
    alumno = db.query(Student).filter(Student.matricula == matricula).first()
    if not alumno:
        raise HTTPException(status_code=404, detail="No existe un alumno.")
    
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
        StudentEnrollment.student_matricula == matricula
    ).all()
    grupos_inscritos = [inscripcion.academic_group_id for inscripcion in inscripciones_db]

    grupos_db = (
        db.query(AcademicGroup)
        .join(Subject, AcademicGroup.subject_id == Subject.id)
        .filter(
            Subject.cuatrimestre == 1, 
            or_(
                Subject.career_id == alumno.career_id, 
                Subject.career_id.is_(None)              
            )
        )
        .all()
    )
    
    materias_dict = {}
    
    for grupo in grupos_db:
        materia = grupo.subject 
        if not materia: continue
            
        es_tronco_comun = materia.career_id is None 
            
        if materia.id not in materias_dict:
            materias_dict[materia.id] = {
                "subject_id": materia.id, "nombre": materia.nombre, 
                "tipo": "Tronco Común" if es_tronco_comun else "Carrera", 
                "grupos_disponibles": []
            }
            
        alumnos_inscritos = db.query(StudentEnrollment).filter(
            StudentEnrollment.academic_group_id == grupo.id
        ).count()
        
        cupos_libres = grupo.cupo_maximo - alumnos_inscritos
        if cupos_libres < 0: cupos_libres = 0

        horario_texto = "Horario por definir"
        sesiones_puras = [] 
        
        try:
            h_data = grupo.horario_json
            if isinstance(h_data, str): h_data = json.loads(h_data)
            
            if isinstance(h_data, list) and len(h_data) > 0:
                sesiones_puras = h_data
                horarios_formateados = [f"{h.get('dia', '')} {h.get('inicio', '')}-{h.get('fin', '')}" for h in h_data]
                horario_texto = " y ".join(horarios_formateados) 
            elif isinstance(h_data, dict):
                for dia, horas in h_data.items():
                    try:
                        inicio, fin = horas.split('-')
                        sesiones_puras.append({"dia": dia.capitalize(), "inicio": inicio.strip(), "fin": fin.strip()})
                    except: pass
                k, v = list(h_data.items())[0]
                horario_texto = f"{k.capitalize()} {v}"
        except Exception:
            pass

        materias_dict[materia.id]["grupos_disponibles"].append({
            "group_id": grupo.id,
            "nombre": grupo.identificador_grupo,  
            "cupo_disponible": cupos_libres, 
            "horario": horario_texto,
            "horario_raw": sesiones_puras 
        })

    return {
        "alumno_matricula": alumno.matricula, "alumno_nombre": nombre_completo.strip().upper(),
        "alumno_cuatrimestre": alumno.cuatrimestre_actual, "carrera": nombre_carrera,
        "grupo_base_bloqueado": bloquear_grupo_base, "grupo_base": "2A" if bloquear_grupo_base else None,
        "grupos_inscritos": grupos_inscritos, "materias_regulares": list(materias_dict.values()),
        "materias_recursamiento": [] 
    }


# endpoint para obtener grupos disponibles en autoservicio, con validaciones adicionales para nuevo ingreso
@router.get("/autoservicio/{matricula}/disponibles")
def obtener_grupos_autoservicio(matricula: str, db: Session = Depends(get_db)):
    alumno = db.query(Student).filter(Student.matricula == matricula).first()
    if not alumno:
        raise HTTPException(status_code=404, detail="No existe el registro del alumno.")
    
    estatus_obj = db.query(StudentStatus).filter(StudentStatus.id == alumno.status_id).first()
    estado_alumno = estatus_obj.name.lower() if estatus_obj else "activo"
    
    if estado_alumno in ["baja", "baja_temporal", "egresado"]:
        raise HTTPException(status_code=403, detail="Credenciales inactivas para el proceso de inscripción.")
        
    if alumno.cuatrimestre_actual < 2:
        raise HTTPException(status_code=403, detail="Estudiantes de nuevo ingreso requieren gestión por Control Escolar.")

    carrera = db.query(Career).filter(Career.id == alumno.career_id).first()
    nombre_carrera = carrera.name if carrera else "Sin carrera"
    nombre_completo = f"{alumno.nombre} {alumno.apellido_paterno} {alumno.apellido_materno}"

    inscripciones_vigentes = db.query(StudentEnrollment).filter(
        StudentEnrollment.student_matricula == matricula
    ).all()
    grupos_inscritos = [i.academic_group_id for i in inscripciones_vigentes]
    
    subject_ids_reprobados = []

    grupos_db = (
        db.query(AcademicGroup)
        .join(Subject, AcademicGroup.subject_id == Subject.id)
        .filter(
            or_(
                Subject.career_id == alumno.career_id,
                Subject.career_id.is_(None)
            )
        )
        .all()
    )
    
    materias_regulares_dict = {}
    materias_recursamiento_dict = {}
    
    for grupo in grupos_db:
        materia = grupo.subject
        if not materia: continue

        es_recursamiento = materia.id in subject_ids_reprobados
        es_regular = materia.cuatrimestre == alumno.cuatrimestre_actual

        if not (es_regular or es_recursamiento):
            continue 

        es_tronco_comun = materia.career_id is None
        dict_destino = materias_recursamiento_dict if es_recursamiento else materias_regulares_dict

        if materia.id not in dict_destino:
            dict_destino[materia.id] = {
                "subject_id": materia.id, 
                "nombre": materia.nombre, 
                "tipo": "Tronco Común" if es_tronco_comun else "Carrera", 
                "grupos_disponibles": []
            }
            
        alumnos_inscritos = db.query(StudentEnrollment).filter(
            StudentEnrollment.academic_group_id == grupo.id
        ).count()
        cupos_libres = max(0, grupo.cupo_maximo - alumnos_inscritos)

        horario_texto = "Horario por definir"
        sesiones_puras = []
        
        try:
            h_data = grupo.horario_json
            if isinstance(h_data, str): h_data = json.loads(h_data)
            
            if isinstance(h_data, list):
                sesiones_puras = h_data
                horarios_formateados = [f"{h.get('dia', '')} {h.get('inicio', '')}-{h.get('fin', '')}" for h in h_data]
                horario_texto = " y ".join(horarios_formateados) 
            elif isinstance(h_data, dict):
                for dia, horas in h_data.items():
                    try:
                        inicio, fin = horas.split('-')
                        sesiones_puras.append({"dia": dia.capitalize(), "inicio": inicio.strip(), "fin": fin.strip()})
                    except: pass
                k, v = list(h_data.items())[0]
                horario_texto = f"{k.capitalize()} {v}"
        except Exception:
            pass

        dict_destino[materia.id]["grupos_disponibles"].append({
            "group_id": grupo.id,
            "nombre": grupo.identificador_grupo,  
            "cupo_disponible": cupos_libres, 
            "horario": horario_texto,
            "horario_raw": sesiones_puras 
        })

    return {
        "alumno_matricula": alumno.matricula, "alumno_nombre": nombre_completo.strip().upper(),
        "alumno_cuatrimestre": alumno.cuatrimestre_actual, "carrera": nombre_carrera,
        "grupo_base_bloqueado": True, "grupo_base": f"{alumno.cuatrimestre_actual}A",
        "grupos_inscritos": grupos_inscritos, 
        "materias_regulares": list(materias_regulares_dict.values()),
        "materias_recursamiento": list(materias_recursamiento_dict.values())
    }



#endpoint para guardar la carga acedmica seleccionada por el alumno de nuevo ingreso
@router.post("/{matricula}/guardar")
def guardar_carga_academica(matricula: str, request: GuardarCargaRequest, db: Session = Depends(get_db)):
    grupos_seleccionados = [m.group_id for m in request.materias]
    
    grupos_a_inscribir = db.query(AcademicGroup).filter(AcademicGroup.id.in_(grupos_seleccionados)).all()
    
    for grupo in grupos_a_inscribir:
        inscritos = db.query(StudentEnrollment).filter(
            StudentEnrollment.academic_group_id == grupo.id
        ).count()
        
        ya_estaba_inscrito = db.query(StudentEnrollment).filter(
            StudentEnrollment.academic_group_id == grupo.id,
            StudentEnrollment.student_matricula == matricula
        ).first()
        
        if not ya_estaba_inscrito and inscritos >= grupo.cupo_maximo:
            raise HTTPException(status_code=400, detail=f"El grupo '{grupo.identificador_grupo}' ya está lleno.")

    horarios_ocupados = [] 
    for grupo in grupos_a_inscribir:
        try:
            h_data = grupo.horario_json
            if isinstance(h_data, str): h_data = json.loads(h_data)
            nombre_materia_actual = grupo.subject.nombre if grupo.subject else f"Grupo {grupo.identificador_grupo}"

            sesiones = []
            if isinstance(h_data, list):
                sesiones = h_data 
            elif isinstance(h_data, dict):
                for dia, horas in h_data.items():
                    try:
                        inicio, fin = horas.split('-')
                        sesiones.append({"dia": dia.capitalize(), "inicio": inicio.strip(), "fin": fin.strip()})
                    except:
                        pass

            for h in sesiones:
                dia_actual = h.get('dia', '').strip()
                ini_a = time_to_minutes(h.get('inicio', '00:00'))
                fin_a = time_to_minutes(h.get('fin', '00:00'))

                for o in horarios_ocupados:
                    if o['dia'].lower() == dia_actual.lower():
                        ini_b = o['inicio_min']
                        fin_b = o['fin_min']
                        
                        if not (fin_a <= ini_b or ini_a >= fin_b):
                            mensaje_error = (
                                f"Cruce de horarios el {dia_actual.capitalize()}: "
                                f"'{nombre_materia_actual}' ({h.get('inicio')} a {h.get('fin')}) "
                                f"choca con '{o['materia']}' ({o['inicio_txt']} a {o['fin_txt']})."
                            )
                            raise HTTPException(status_code=400, detail=mensaje_error)
                
                horarios_ocupados.append({
                    'dia': dia_actual, 
                    'inicio_min': ini_a, 'fin_min': fin_a, 
                    'inicio_txt': h.get('inicio'), 'fin_txt': h.get('fin'),
                    'materia': nombre_materia_actual
                })
        except HTTPException as he:
            raise he 
        except Exception as e: 
            print(f"Error procesando el horario del grupo {grupo.identificador_grupo}: {e}")

    try:
        inscripciones_viejas = db.query(StudentEnrollment).filter(
            StudentEnrollment.student_matricula == matricula
        ).all()
        
        old_values = {
            "grupos_inscritos": [insc.academic_group_id for insc in inscripciones_viejas]
        }
        
        db.query(StudentEnrollment).filter(
            StudentEnrollment.student_matricula == matricula
        ).delete()

        nuevos_grupos = []
        for materia in request.materias:
            grupo_obj = next((g for g in grupos_a_inscribir if g.id == materia.group_id), None)
            periodo_grupo = grupo_obj.periodo if grupo_obj else "2026-1"
            
            nueva_inscripcion = StudentEnrollment(
                student_matricula=matricula,
                academic_group_id=materia.group_id, 
                period_name=periodo_grupo,
                is_retake=materia.is_retake
            )
            db.add(nueva_inscripcion)
            nuevos_grupos.append(materia.group_id)

        new_values = {
            "grupos_inscritos": nuevos_grupos
        }

        log_audit_event(
            db=db,
            user_identifier=request.usuario_id,
            action="UPDATE",
            entity_name="student_enrollments",
            entity_id=matricula,
            old_values=old_values,
            new_values=new_values
        )

        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en BD: {str(e)}")
        
    return {
        "message": "¡Carga académica guardada exitosamente en la Base de Datos!",
        "materias_inscritas": len(request.materias)
    }

# endpoint para buscar alumno por matricula con una funcionalidad de autocompletado
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

# endpoint para obtener el horario real de un alumno
@router.get("/{matricula}/horario")
def obtener_horario_real(matricula: str, db: Session = Depends(get_db)):
    query = text("""
        SELECT ag.horario_json, m.nombre AS materia, m.career_id, CONCAT(t.nombre, ' ', t.apellido_paterno) AS profe
        FROM student_enrollments se
        JOIN academic_groups ag ON se.academic_group_id = ag.id
        JOIN subjects m ON ag.subject_id = m.id
        LEFT JOIN teachers t ON ag.teacher_id = t.id
        WHERE se.student_matricula = :matricula
    """)
    resultados = db.execute(query, {"matricula": matricula}).mappings().all()
    horario_formateado = []
    
    colores_carrera = [
    '#2563EB', '#DC2626', '#16A34A', '#D97706', '#9333EA', 
    '#0891B2', '#EA580C', '#4F46E5', '#C026D3', '#4D7C0F'
    ]   
    color_tronco_comun = '#475569' 
    
    mapa_colores = {}
    idx_color = 0
    
    for row in resultados:
        materia = row["materia"]
        profe = row["profe"] or "S/A"
        h_json = row["horario_json"]
        
        es_tronco_comun = row["career_id"] is None
        
        if materia not in mapa_colores:
            if es_tronco_comun:
                mapa_colores[materia] = color_tronco_comun
            else:
                mapa_colores[materia] = colores_carrera[idx_color % len(colores_carrera)]
                idx_color += 1
                
        color_final = mapa_colores[materia]
        
        if not h_json: continue
        
        try:
            data = h_json if isinstance(h_json, (dict, list)) else json.loads(h_json)
            if isinstance(data, str): data = json.loads(data)
        except: continue
        
        if isinstance(data, list):
            for sesion in data:
                if not isinstance(sesion, dict): continue
                dia = sesion.get("dia", "").upper().replace("É", "E").replace("Á", "A")
                if dia == "MIERCOLES": dia = "MIÉRCOLES"
                if dia == "SABADO": dia = "SÁBADO"
                
                inicio_str, fin_str = sesion.get("inicio", "0"), sesion.get("fin", "0")
                if inicio_str and fin_str:
                    try:
                        h_i, h_f = int(inicio_str.split(":")[0]), int(fin_str.split(":")[0])
                        duracion = h_f - h_i
                        if duracion > 0:
                            horario_formateado.append({
                                "dia": dia, "hora_inicio": h_i, "duracion": duracion,
                                "hora": f"{h_i}:00 - {h_f}:00", "materia": materia, 
                                "profe": profe, "aula": "Por Asignar", "color": color_final 
                            })
                    except ValueError: pass
                    
        elif isinstance(data, dict):
            for dia_clave, horas_str in data.items():
                dia = dia_clave.upper().replace("É", "E").replace("Á", "A")
                if dia == "MIERCOLES": dia = "MIÉRCOLES"
                if dia == "SABADO": dia = "SÁBADO"
                
                partes = horas_str.split("-")
                if len(partes) == 2:
                    try:
                        h_i = int(partes[0].split(":")[0])
                        h_f = int(partes[1].split(":")[0])
                        duracion = h_f - h_i
                        if duracion > 0:
                            horario_formateado.append({
                                "dia": dia, "hora_inicio": h_i, "duracion": duracion,
                                "hora": f"{h_i}:00 - {h_f}:00", "materia": materia, 
                                "profe": profe, "aula": "Por Asignar", "color": color_final 
                            })
                    except ValueError: pass
                        
    return horario_formateado