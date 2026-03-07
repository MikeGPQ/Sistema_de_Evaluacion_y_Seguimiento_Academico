import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.database import get_db

from app.schemas.enrollment import GuardarCargaRequest
from app.models.student import Student
from app.models.career import Career
from app.models.enrollment import StudentEnrollment 
from app.models.academic_group import AcademicGroup
from app.models.subject import Subject
from app.models.student_status import StudentStatus

router = APIRouter(prefix="/asignacion", tags=["Asignación de Horarios"])

@router.get("/{matricula}/disponibles")
def obtener_grupos_disponibles(matricula: str, db: Session = Depends(get_db)):
    alumno = db.query(Student).filter(Student.matricula == matricula).first()
    if not alumno:
        raise HTTPException(status_code=404, detail="No existe un alumno.")
    
    # Validación de estado
    estatus_obj = db.query(StudentStatus).filter(StudentStatus.id == alumno.status_id).first()
    estado_alumno = estatus_obj.name.lower() if estatus_obj else "activo"
    
    if estado_alumno in ["baja", "baja_temporal", "egresado"]:
        raise HTTPException(
            status_code=403, 
            detail=f"El alumno está en '{estado_alumno.upper()}'. No puede editar horario."
        )
        
    carrera = db.query(Career).filter(Career.id == alumno.career_id).first()
    nombre_carrera = carrera.name if carrera else "Sin carrera"
    nombre_completo = f"{alumno.nombre} {alumno.apellido_paterno} {alumno.apellido_materno}"
    
    inscripciones_db = db.query(StudentEnrollment).filter(
        StudentEnrollment.student_matricula == matricula,
        StudentEnrollment.period_name == "2026-1"
    ).all()
    grupos_inscritos = [inscripcion.academic_group_id for inscripcion in inscripciones_db]

    # Obtenemos grupos y calculamos cupos reales
    grupos_db = db.query(AcademicGroup).filter(AcademicGroup.periodo == "2026-1").all()
    materias_dict = {}
    
    for grupo in grupos_db:
        materia = grupo.subject 
        if not materia: continue
            
        if materia.id not in materias_dict:
            materias_dict[materia.id] = {
                "subject_id": materia.id, "nombre": materia.nombre, 
                "tipo": "Carrera", "grupos_disponibles": []
            }
            
        inscritos = db.query(StudentEnrollment).filter(StudentEnrollment.academic_group_id == grupo.id).count()
        cupos_libres = max(0, grupo.cupo_maximo - inscritos)

        
       # --- CÓDIGO PARA LEER LISTAS Y DICCIONARIOS ---
        horario_texto = "Horario por definir"
        try:
            h_data = grupo.horario_json
            if isinstance(h_data, str): 
                h_data = json.loads(h_data)
                
            if isinstance(h_data, list) and len(h_data) > 0:
                horarios_formateados = [f"{h.get('dia', '')} {h.get('inicio', '')}-{h.get('fin', '')}" for h in h_data]
                horario_texto = " y ".join(horarios_formateados)
            elif isinstance(h_data, dict):
                # Si viene en formato diccionario {"miercoles": "08:00-10:00"}
                k, v = list(h_data.items())[0]
                horario_texto = f"{k.capitalize()} {v}"
        except Exception:
            pass
    
      

        materias_dict[materia.id]["grupos_disponibles"].append({
            "group_id": grupo.id,
            "nombre": grupo.identificador_grupo,  
            "cupo_disponible": cupos_libres, 
            "horario": horario_texto # Ahora mandamos el texto real
        })

    return {
        "alumno_matricula": alumno.matricula, "alumno_nombre": nombre_completo.strip().upper(),
        "alumno_cuatrimestre": alumno.cuatrimestre_actual, "carrera": nombre_carrera,
        "grupos_inscritos": grupos_inscritos, "materias_regulares": list(materias_dict.values()),
        "materias_recursamiento": [] 
    }

@router.post("/{matricula}/guardar")
def guardar_carga_academica(matricula: str, request: GuardarCargaRequest, db: Session = Depends(get_db)):
    grupos_seleccionados = [m.group_id for m in request.materias]
    grupos_a_inscribir = db.query(AcademicGroup).filter(AcademicGroup.id.in_(grupos_seleccionados)).all()
    
    # 🌟 VALIDACIÓN DE CUPO LLENO (Lógica de tu compañero)
    for grupo in grupos_a_inscribir:
        inscritos = db.query(StudentEnrollment).filter(
            StudentEnrollment.academic_group_id == grupo.id,
            StudentEnrollment.period_name == "2026-1"
        ).count()
        
        ya_estaba_inscrito = db.query(StudentEnrollment).filter(
            StudentEnrollment.academic_group_id == grupo.id,
            StudentEnrollment.student_matricula == matricula
        ).first()
        
        if not ya_estaba_inscrito and inscritos >= grupo.cupo_maximo:
            raise HTTPException(status_code=400, detail=f"El grupo '{grupo.identificador_grupo}' ya está lleno.")

    # 🌟 VALIDACIÓN DE CHOQUE DE HORARIOS (Lógica de tu compañero)
    horarios_ocupados = [] 
    for grupo in grupos_a_inscribir:
        try:
            h_data = grupo.horario_json
            if isinstance(h_data, str): h_data = json.loads(h_data)
            
            nombre_materia_actual = grupo.subject.nombre if grupo.subject else f"Grupo {grupo.identificador_grupo}"

            if isinstance(h_data, list):
                for h in h_data:
                    dia_actual = h.get('dia', '')
                    inicio_actual = h.get('inicio', '')
                    fin_actual = h.get('fin', '')

                    for o in horarios_ocupados:
                        if o['dia'].lower() == dia_actual.lower():
                            if not (fin_actual <= o['inicio'] or inicio_actual >= o['fin']):
                                mensaje_error = (
                                    f"El {dia_actual.capitalize()} tienes un choque de horarios: "
                                    f"'{nombre_materia_actual}' ({inicio_actual} a {fin_actual}) "
                                    f"choca con '{o['materia']}' ({o['inicio']} a {o['fin']})."
                                )
                                raise HTTPException(status_code=400, detail=mensaje_error)
                    
                    horarios_ocupados.append({
                        'dia': dia_actual, 
                        'inicio': inicio_actual,
                        'fin': fin_actual, 
                        'grupo': grupo.identificador_grupo,
                        'materia': nombre_materia_actual 
                    })
        except HTTPException as he:
            raise he 
        except Exception:
            pass 

    # 🌟 GUARDADO REAL EN LA BASE DE DATOS
    try:
        db.query(StudentEnrollment).filter(
            StudentEnrollment.student_matricula == matricula,
            StudentEnrollment.period_name == "2026-1"
        ).delete()

        for materia in request.materias:
            db.add(StudentEnrollment(
                student_matricula=matricula, 
                academic_group_id=materia.group_id,
                period_name="2026-1", 
                is_retake=materia.is_retake
            ))
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
        
    return {"message": "¡Carga académica guardada exitosamente!"}

@router.get("/{matricula}/horario")
def obtener_horario_real(matricula: str, db: Session = Depends(get_db)):
    query = text("""
        SELECT ag.horario_json, m.nombre AS materia, CONCAT(t.nombre, ' ', t.apellido_paterno) AS profe
        FROM student_enrollments se
        JOIN academic_groups ag ON se.academic_group_id = ag.id
        JOIN subjects m ON ag.subject_id = m.id
        LEFT JOIN teachers t ON ag.teacher_id = t.id
        WHERE se.student_matricula = :matricula
    """)
    resultados = db.execute(query, {"matricula": matricula}).mappings().all()
    horario_formateado = []
    colores = ['#3b82f6', '#f97316', '#22c55e', '#ef4444', '#14b8a6', '#a855f7', '#6366f1']
    
    for idx, row in enumerate(resultados):
        materia, profe, color = row["materia"], row["profe"] or "S/A", colores[idx % len(colores)]
        h_json = row["horario_json"]
        if not h_json: continue
        
        try:
            data = h_json if isinstance(h_json, (dict, list)) else json.loads(h_json)
        except json.JSONDecodeError: continue

        if isinstance(data, str):
             try: data = json.loads(data)
             except json.JSONDecodeError: continue
        
        if isinstance(data, list):
            for sesion in data:
                if not isinstance(sesion, dict): continue
                dia = sesion.get("dia", "").upper()
                if dia in ["MIERCOLES", "MIÉRCOLES"]: dia = "MIÉRCOLES"
                if dia in ["SABADO", "SÁBADO"]: dia = "SÁBADO"
                
                inicio_str = sesion.get("inicio", "0")
                fin_str = sesion.get("fin", "0")
                
                if inicio_str and fin_str:
                    try:
                        h_i = int(inicio_str.split(":")[0])
                        h_f = int(fin_str.split(":")[0])
                        duracion = h_f - h_i
                        
                        # 🌟 En lugar de un bucle, mandamos la duración exacta
                        if duracion > 0:
                            horario_formateado.append({
                                "dia": dia, "hora_inicio": h_i, "duracion": duracion,
                                "hora": f"{h_i}:00 - {h_f}:00", "materia": materia, 
                                "profe": profe, "aula": "Por Asignar", "color": color
                            })
                    except ValueError: pass
                         
        elif isinstance(data, dict):
            for dia_clave, horas_str in data.items():
                dia = dia_clave.upper()
                if dia in ["MIERCOLES", "MIÉRCOLES"]: dia = "MIÉRCOLES"
                if dia in ["SABADO", "SÁBADO"]: dia = "SÁBADO"
                
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
                                "profe": profe, "aula": "Por Asignar", "color": color
                            })
                    except ValueError: pass
                        
    return horario_formateado