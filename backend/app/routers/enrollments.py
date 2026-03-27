import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_ 
from app.db.database import get_db
from app.schemas.enrollment import GuardarCargaRequest
from app.models.student import Student
from app.models.student_academic_profile import StudentAcademicProfile
from app.models.academic_program import AcademicProgram
from app.models.enrollment import StudentEnrollment 
from app.models.academic_group import AcademicGroup
from app.models.subject import Subject
from app.models.student_status import StudentStatus
from app.services.audit_service import log_audit_event
from datetime import time

router = APIRouter(prefix="/asignacion", tags=["Asignación de Horarios"])

def time_to_minutes(t):
    if isinstance(t, str):
        try:
            h, m = map(int, t.replace(" ", "").split(':'))
            return h * 60 + m
        except:
            return 0
    if isinstance(t, time):
        return t.hour * 60 + t.minute
    return 0

DIAS_MAP = {1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado", 7: "Domingo"}

@router.get("/{matricula}/disponibles")
def obtener_grupos_disponibles(matricula: str, db: Session = Depends(get_db)):
    alumno = db.query(Student).filter(Student.matricula == matricula).first()
    if not alumno:
        raise HTTPException(status_code=404, detail="No existe un alumno.")
    
    perfil = db.query(StudentAcademicProfile).filter(StudentAcademicProfile.student_matricula == matricula).order_by(StudentAcademicProfile.id.desc()).first()
    if not perfil:
        raise HTTPException(status_code=404, detail="El alumno no tiene un perfil académico activo.")

    estado_alumno = perfil.status.name.lower() if perfil.status else "activo"
    
    if estado_alumno in ["baja", "baja_temporal", "egresado"]:
        raise HTTPException(
            status_code=403, 
            detail=f"El alumno se encuentra en estado '{estado_alumno.upper()}'. No se puede editar ni actualizar su horario hasta que vuelva a estar ACTIVO."
        )
        
    nombre_carrera = perfil.career.name if perfil.career else "Sin programa asignado"
    nombre_completo = f"{alumno.nombre} {alumno.apellido_paterno} {alumno.apellido_materno}"
    
    cuatrimestre_actual_num = int(perfil.quarter_actual.external_id) if perfil.quarter_actual and str(perfil.quarter_actual.external_id).isdigit() else 1
    bloquear_grupo_base = cuatrimestre_actual_num > 1

    inscripciones_db = db.query(StudentEnrollment).filter(
        StudentEnrollment.academic_profile_id == perfil.id
    ).all()
    grupos_inscritos = [inscripcion.academic_group_id for inscripcion in inscripciones_db]

    grupos_db = (
        db.query(AcademicGroup)
        .join(Subject, AcademicGroup.subject_id == Subject.id)
        .filter(
            Subject.quarter_id == perfil.quarter_actual_id,
            or_(
                Subject.career_id == perfil.career_id,
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
        
        cupos_libres = max(0, (grupo.subject.cupo_maximo or 30) - alumnos_inscritos)

        horario_texto = "Horario por definir"
        sesiones_puras = [] 
        
        if grupo.schedules:
            horarios_formateados = []
            for s in grupo.schedules:
                dia_str = DIAS_MAP.get(s.dia_semana, "Desconocido")
                ini_str = s.hora_inicio.strftime("%H:%M") if s.hora_inicio else ""
                fin_str = s.hora_fin.strftime("%H:%M") if s.hora_fin else ""
                
                sesiones_puras.append({"dia": dia_str, "inicio": ini_str, "fin": fin_str})
                horarios_formateados.append(f"{dia_str} {ini_str}-{fin_str}")
            
            horario_texto = " y ".join(horarios_formateados)

        materias_dict[materia.id]["grupos_disponibles"].append({
            "group_id": grupo.id,
            "external_id": grupo.external_id,
            "nombre": grupo.sigad_group.identificador if grupo.sigad_group else str(grupo.id),
            "aula": grupo.classroom.nombre_codigo if grupo.classroom else None,
            "cupo_disponible": cupos_libres,
            "horario": horario_texto,
            "horario_raw": sesiones_puras
        })

    return {
        "alumno_matricula": alumno.matricula, "alumno_nombre": nombre_completo.strip().upper(),
        "alumno_cuatrimestre": cuatrimestre_actual_num, "carrera": nombre_carrera,
        "grupo_base_bloqueado": bloquear_grupo_base, "grupo_base": f"{cuatrimestre_actual_num}A" if bloquear_grupo_base else None,
        "grupos_inscritos": grupos_inscritos, "materias_regulares": list(materias_dict.values()),
        "materias_recursamiento": [] 
    }

@router.get("/autoservicio/{matricula}/disponibles")
def obtener_grupos_autoservicio(matricula: str, db: Session = Depends(get_db)):
    alumno = db.query(Student).filter(Student.matricula == matricula).first()
    if not alumno:
        raise HTTPException(status_code=404, detail="No existe el registro del alumno.")
    
    perfil = db.query(StudentAcademicProfile).filter(StudentAcademicProfile.student_matricula == matricula).order_by(StudentAcademicProfile.id.desc()).first()
    if not perfil:
        raise HTTPException(status_code=404, detail="El alumno no tiene un perfil académico activo.")

    estado_alumno = perfil.status.name.lower() if perfil.status else "activo"
    
    if estado_alumno in ["baja", "baja_temporal", "egresado"]:
        raise HTTPException(status_code=403, detail="Credenciales inactivas para el proceso de inscripción.")
        
    cuatrimestre_actual_num = int(perfil.quarter_actual.external_id) if perfil.quarter_actual and str(perfil.quarter_actual.external_id).isdigit() else 1

    if cuatrimestre_actual_num < 2:
        raise HTTPException(status_code=403, detail="Estudiantes de nuevo ingreso requieren gestión por Control Escolar.")

    nombre_carrera = perfil.career.name if perfil.career else "Sin programa"
    nombre_completo = f"{alumno.nombre} {alumno.apellido_paterno} {alumno.apellido_materno}"

    inscripciones_vigentes = db.query(StudentEnrollment).filter(
        StudentEnrollment.academic_profile_id == perfil.id
    ).all()
    grupos_inscritos = [i.academic_group_id for i in inscripciones_vigentes]
    
    subject_ids_reprobados = [] 

    grupos_db = (
        db.query(AcademicGroup)
        .join(Subject, AcademicGroup.subject_id == Subject.id)
        .filter(
            or_(
                Subject.career_id == perfil.career_id,
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
        es_regular = materia.quarter_id == perfil.quarter_actual_id

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
        cupos_libres = max(0, (grupo.subject.cupo_maximo or 30) - alumnos_inscritos)

        horario_texto = "Horario por definir"
        sesiones_puras = []
        
        if grupo.schedules:
            horarios_formateados = []
            for s in grupo.schedules:
                dia_str = DIAS_MAP.get(s.dia_semana, "Desconocido")
                ini_str = s.hora_inicio.strftime("%H:%M") if s.hora_inicio else ""
                fin_str = s.hora_fin.strftime("%H:%M") if s.hora_fin else ""
                
                sesiones_puras.append({"dia": dia_str, "inicio": ini_str, "fin": fin_str})
                horarios_formateados.append(f"{dia_str} {ini_str}-{fin_str}")
            
            horario_texto = " y ".join(horarios_formateados)

        dict_destino[materia.id]["grupos_disponibles"].append({
            "group_id": grupo.id,
            "external_id": grupo.external_id,
            "nombre": grupo.sigad_group.identificador if grupo.sigad_group else str(grupo.id),
            "aula": grupo.classroom.nombre_codigo if grupo.classroom else None,
            "cupo_disponible": cupos_libres,
            "horario": horario_texto,
            "horario_raw": sesiones_puras
        })

    return {
        "alumno_matricula": alumno.matricula, "alumno_nombre": nombre_completo.strip().upper(),
        "alumno_cuatrimestre": cuatrimestre_actual_num, "carrera": nombre_carrera,
        "grupo_base_bloqueado": True, "grupo_base": f"{cuatrimestre_actual_num}A",
        "grupos_inscritos": grupos_inscritos, 
        "materias_regulares": list(materias_regulares_dict.values()),
        "materias_recursamiento": list(materias_recursamiento_dict.values())
    }

@router.post("/{matricula}/guardar")
def guardar_carga_academica(matricula: str, request: GuardarCargaRequest, db: Session = Depends(get_db)):
    perfil = db.query(StudentAcademicProfile).filter(StudentAcademicProfile.student_matricula == matricula).order_by(StudentAcademicProfile.id.desc()).first()
    if not perfil:
        raise HTTPException(status_code=404, detail="El alumno no tiene un perfil académico activo.")

    grupos_seleccionados = [m.group_id for m in request.materias]
    grupos_a_inscribir = db.query(AcademicGroup).filter(AcademicGroup.id.in_(grupos_seleccionados)).all()
    
    for grupo in grupos_a_inscribir:
        inscritos = db.query(StudentEnrollment).filter(
            StudentEnrollment.academic_group_id == grupo.id
        ).count()
        
        ya_estaba_inscrito = db.query(StudentEnrollment).filter(
            StudentEnrollment.academic_group_id == grupo.id,
            StudentEnrollment.academic_profile_id == perfil.id
        ).first()
        
        if not ya_estaba_inscrito and inscritos >= (grupo.subject.cupo_maximo or 30):
            identificador = grupo.sigad_group.identificador if grupo.sigad_group else str(grupo.id)
            raise HTTPException(status_code=400, detail=f"El grupo '{identificador}' ya está lleno.")

    horarios_ocupados = [] 
    for grupo in grupos_a_inscribir:
        nombre_materia_actual = grupo.subject.nombre if grupo.subject else f"Grupo {grupo.identificador_grupo}"

        for s in grupo.schedules:
            dia_actual = DIAS_MAP.get(s.dia_semana, "Desconocido")
            ini_a = time_to_minutes(s.hora_inicio)
            fin_a = time_to_minutes(s.hora_fin)

            for o in horarios_ocupados:
                if o['dia'].lower() == dia_actual.lower():
                    ini_b = o['inicio_min']
                    fin_b = o['fin_min']
                    
                    if not (fin_a <= ini_b or ini_a >= fin_b):
                        mensaje_error = (
                            f"Cruce de horarios el {dia_actual.capitalize()}: "
                            f"'{nombre_materia_actual}' ({s.hora_inicio.strftime('%H:%M')} a {s.hora_fin.strftime('%H:%M')}) "
                            f"choca con '{o['materia']}' ({o['inicio_txt']} a {o['fin_txt']})."
                        )
                        raise HTTPException(status_code=400, detail=mensaje_error)
            
            horarios_ocupados.append({
                'dia': dia_actual, 
                'inicio_min': ini_a, 'fin_min': fin_a, 
                'inicio_txt': s.hora_inicio.strftime("%H:%M") if s.hora_inicio else "", 
                'fin_txt': s.hora_fin.strftime("%H:%M") if s.hora_fin else "",
                'materia': nombre_materia_actual
            })

    try:
        inscripciones_viejas = db.query(StudentEnrollment).filter(
            StudentEnrollment.academic_profile_id == perfil.id
        ).all()
        
        materias_viejas = []
        for insc in inscripciones_viejas:
            materia_nombre = insc.academic_group.subject.nombre if insc.academic_group and insc.academic_group.subject else f"Grupo {insc.academic_group_id}"
            materias_viejas.append(materia_nombre)
            
        old_values = {
            "Materias inscritas": materias_viejas
        }
        
        db.query(StudentEnrollment).filter(
            StudentEnrollment.academic_profile_id == perfil.id
        ).delete()

        materias_nuevas = []
        for materia in request.materias:
            nueva_inscripcion = StudentEnrollment(
                student_matricula=matricula,
                academic_profile_id=perfil.id,
                academic_group_id=materia.group_id,
                period_id=perfil.period_id,
                is_retake=materia.is_retake
            )
            db.add(nueva_inscripcion)
            
            grupo_obj = next((g for g in grupos_a_inscribir if g.id == materia.group_id), None)
            materia_nom = grupo_obj.subject.nombre if grupo_obj and grupo_obj.subject else f"Grupo {materia.group_id}"
            materias_nuevas.append(materia_nom)

        new_values = {
            "Materias inscritas": materias_nuevas
        }

        if sorted(materias_viejas) != sorted(materias_nuevas):
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

@router.get("/{matricula}/horario")
def obtener_horario_real(matricula: str, db: Session = Depends(get_db)):
    perfil = db.query(StudentAcademicProfile).filter(StudentAcademicProfile.student_matricula == matricula).order_by(StudentAcademicProfile.id.desc()).first()
    if not perfil:
        return []

    inscripciones = db.query(StudentEnrollment).filter(StudentEnrollment.academic_profile_id == perfil.id).all()
    
    horario_formateado = []
    
    colores_carrera = [
        '#2563EB', '#DC2626', '#16A34A', '#D97706', '#9333EA', 
        '#0891B2', '#EA580C', '#4F46E5', '#C026D3', '#4D7C0F'
    ]   
    color_tronco_comun = '#475569' 
    
    mapa_colores = {}
    idx_color = 0
    
    for insc in inscripciones:
        grupo = insc.academic_group
        materia_obj = grupo.subject if grupo else None
        
        if not grupo or not materia_obj:
            continue
            
        materia = materia_obj.nombre
        profe = f"{grupo.teacher.nombre} {grupo.teacher.apellido_paterno}" if grupo.teacher else "S/A"
        es_tronco_comun = materia_obj.career_id is None
        
        if materia not in mapa_colores:
            if es_tronco_comun:
                mapa_colores[materia] = color_tronco_comun
            else:
                mapa_colores[materia] = colores_carrera[idx_color % len(colores_carrera)]
                idx_color += 1
                
        color_final = mapa_colores[materia]
        
        for s in grupo.schedules:
            if not s.hora_inicio or not s.hora_fin:
                continue
                
            dia_str = DIAS_MAP.get(s.dia_semana, "").upper()
            if dia_str == "MIERCOLES": dia_str = "MIÉRCOLES"
            if dia_str == "SABADO": dia_str = "SÁBADO"
            
            h_i = s.hora_inicio.hour
            h_f = s.hora_fin.hour
            duracion = h_f - h_i
            
            if duracion > 0:
                horario_formateado.append({
                    "dia": dia_str, "hora_inicio": h_i, "duracion": duracion,
                    "hora": f"{h_i}:00 - {h_f}:00", "materia": materia, 
                    "profe": profe, "aula": "Por Asignar", "color": color_final 
                })
                        
    return horario_formateado