import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from sqlalchemy import func
from app.db.database import get_db
from app.schemas.enrollment import GuardarCargaRequest
from app.models.student import Student
from app.models.student_academic_profile import StudentAcademicProfile
from app.models.academic_program import AcademicProgram
from app.models.enrollment import StudentEnrollment
from app.models.academic_group import AcademicGroup
from app.models.subject import Subject
from app.models.academic_period import AcademicPeriod
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

    perfil = db.query(StudentAcademicProfile).filter(
        StudentAcademicProfile.student_matricula == matricula
    ).order_by(StudentAcademicProfile.id.desc()).first()
    if not perfil:
        raise HTTPException(status_code=404, detail="El alumno no tiene un perfil académico activo.")

    nivel_raw = perfil.nivel.name.lower() if perfil.nivel else "licenciatura"
    nivel_alumno = nivel_raw if nivel_raw else "licenciatura"
    es_maestria = nivel_alumno == "maestria"

    estado_alumno = perfil.status.name.lower() if perfil.status else "activo"
    if estado_alumno in ["baja", "baja_temporal", "egresado"]:
        raise HTTPException(
            status_code=403,
            detail=f"El alumno se encuentra en estado '{estado_alumno.upper()}'. "
                   "No se puede editar ni actualizar su horario hasta que vuelva a estar ACTIVO."
        )

    periodo_actual = db.query(AcademicPeriod).filter(AcademicPeriod.is_active == True).first()
    if not periodo_actual:
        raise HTTPException(status_code=400, detail="No hay periodo académico activo.")

    nombre_carrera = perfil.career.name if perfil.career else "Sin programa asignado"
    nombre_completo = f"{alumno.nombre} {alumno.apellido_paterno} {alumno.apellido_materno}"

    try:
        cuatrimestre_actual_num = (
            int(perfil.quarter_actual.external_id)
            if perfil.quarter_actual and hasattr(perfil.quarter_actual, 'external_id')
            and str(perfil.quarter_actual.external_id).isdigit()
            else int(perfil.quarter_actual_id or 1)
        )
    except:
        cuatrimestre_actual_num = 1

    bloquear_grupo_base = cuatrimestre_actual_num > 1

    inscripciones_db = db.query(StudentEnrollment).join(AcademicGroup).filter(
        StudentEnrollment.academic_profile_id == perfil.id,
        AcademicGroup.period_id == periodo_actual.id,
        AcademicGroup.estatus_acta != 'CERRADA'
    ).all()
    grupos_inscritos = [i.academic_group_id for i in inscripciones_db]

    quarter_filter = (
        Subject.quarter_id >= perfil.quarter_actual_id
        if es_maestria
        else Subject.quarter_id == perfil.quarter_actual_id
    )

    grupos_db = (
        db.query(AcademicGroup)
        .join(Subject, AcademicGroup.subject_id == Subject.id)
        .filter(
            AcademicGroup.period_id == periodo_actual.id,
            AcademicGroup.estatus_acta != 'CERRADA',
            quarter_filter,
            or_(
                Subject.career_id == perfil.career_id,
                Subject.career_id.is_(None)
            ),
            func.lower(Subject.nivel_academico) == nivel_alumno
        )
        .all()
    )

    materias_dict = {}
    materias_adelanto_dict = {}

    for grupo in grupos_db:
        materia = grupo.subject
        if not materia:
            continue

        es_tronco_comun = materia.career_id is None
        es_regular = materia.quarter_id == perfil.quarter_actual_id
        es_adelanto = materia.quarter_id > perfil.quarter_actual_id and es_maestria

        if not (es_regular or es_adelanto):
            continue

        dict_destino = materias_adelanto_dict if es_adelanto else materias_dict

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
        "alumno_matricula": alumno.matricula,
        "alumno_nombre": nombre_completo.strip().upper(),
        "alumno_cuatrimestre": cuatrimestre_actual_num,
        "carrera": nombre_carrera,
        "grupo_base_bloqueado": bloquear_grupo_base,
        "grupo_base": f"{cuatrimestre_actual_num}A" if bloquear_grupo_base else None,
        "grupos_inscritos": grupos_inscritos,
        "es_maestria": es_maestria,
        "materias_regulares": list(materias_dict.values()),
        "materias_recursamiento": [],
        "materias_adelanto": list(materias_adelanto_dict.values())
    }

@router.get("/autoservicio/{matricula}/disponibles")
def obtener_grupos_autoservicio(matricula: str, db: Session = Depends(get_db)):
    alumno = db.query(Student).filter(Student.matricula == matricula).first()
    if not alumno:
        raise HTTPException(status_code=404, detail="No existe el registro del alumno.")

    perfil = db.query(StudentAcademicProfile).filter(
        StudentAcademicProfile.student_matricula == matricula
    ).order_by(StudentAcademicProfile.id.desc()).first()
    if not perfil:
        raise HTTPException(status_code=404, detail="El alumno no tiene un perfil académico activo.")

    estado_alumno = perfil.status.name.lower() if perfil.status else "activo"
    if estado_alumno in ["baja", "baja_temporal", "egresado"]:
        raise HTTPException(status_code=403, detail="Credenciales inactivas para el proceso de inscripción.")

    periodo_actual = db.query(AcademicPeriod).filter(AcademicPeriod.is_active == True).first()
    if not periodo_actual:
        raise HTTPException(status_code=400, detail="No hay un periodo académico activo para realizar inscripciones.")

    try:
        perf_q = (
            int(perfil.quarter_actual.external_id)
            if perfil.quarter_actual and hasattr(perfil.quarter_actual, 'external_id')
            and str(perfil.quarter_actual.external_id).isdigit()
            else int(perfil.quarter_actual_id or 1)
        )
    except:
        perf_q = 1

    if perf_q < 2:
        raise HTTPException(status_code=403, detail="Estudiantes de nuevo ingreso requieren gestión por Control Escolar.")

    nombre_carrera = perfil.career.name if perfil.career else "Sin programa"
    nombre_completo = f"{alumno.nombre} {alumno.apellido_paterno} {alumno.apellido_materno}"

    nivel_alumno = perfil.nivel.name.lower() if perfil.nivel else "licenciatura"

    inscripciones_vigentes = db.query(StudentEnrollment).join(AcademicGroup).filter(
        StudentEnrollment.academic_profile_id == perfil.id,
        AcademicGroup.period_id == periodo_actual.id,
        AcademicGroup.estatus_acta != 'CERRADA'
    ).all()
    grupos_inscritos = [i.academic_group_id for i in inscripciones_vigentes]

    aprobadas_db = (
        db.query(AcademicGroup.subject_id)
        .join(StudentEnrollment, StudentEnrollment.academic_group_id == AcademicGroup.id)
        .filter(
            StudentEnrollment.student_matricula == matricula,
            StudentEnrollment.calificacion_final >= 7
        ).all()
    )
    subject_ids_aprobados = [a[0] for a in aprobadas_db]

    historial_db = (
        db.query(AcademicGroup.subject_id)
        .join(StudentEnrollment, StudentEnrollment.academic_group_id == AcademicGroup.id)
        .filter(StudentEnrollment.student_matricula == matricula)
        .all()
    )
    subject_ids_historicos = [h[0] for h in historial_db]

    materias_plan = db.query(Subject).filter(
        func.lower(Subject.nivel_academico) == nivel_alumno,
        or_(
            Subject.career_id == perfil.career_id,
            Subject.career_id.is_(None)
        )
    ).all()

    todos_grupos_abiertos = db.query(AcademicGroup).filter(
        AcademicGroup.period_id == periodo_actual.id,
        AcademicGroup.estatus_acta != 'CERRADA'
    ).all()

    materias_regulares_dict = {}
    materias_recursamiento_dict = {}
    materias_pendientes_dict = {}

    for materia in materias_plan:
        if materia.id in subject_ids_aprobados:
            continue

        try:
            mat_q = (
                int(materia.quarter.external_id)
                if hasattr(materia, 'quarter') and materia.quarter
                and hasattr(materia.quarter, 'external_id')
                and str(materia.quarter.external_id).isdigit()
                else int(materia.quarter_id or 1)
            )
        except:
            mat_q = 1

        es_misma_temporada = (mat_q % 3) == (perf_q % 3)
        if not es_misma_temporada:
            continue

        grupos_materia = [g for g in todos_grupos_abiertos if g.subject_id == materia.id]
        tiene_grupos = len(grupos_materia) > 0
        es_su_cuatrimestre = (mat_q == perf_q)

        if not tiene_grupos and not es_su_cuatrimestre:
            continue

        es_recursamiento = (materia.id in subject_ids_historicos)
        es_pendiente = (mat_q < perf_q) and not es_recursamiento
        es_tronco_comun = materia.career_id is None

        if es_recursamiento:
            dict_destino = materias_recursamiento_dict
        elif es_pendiente:
            dict_destino = materias_pendientes_dict
        else:
            dict_destino = materias_regulares_dict

        dict_destino[materia.id] = {
            "subject_id": materia.id,
            "nombre": materia.nombre,
            "tipo": "Tronco Común" if es_tronco_comun else "Carrera",
            "grupos_disponibles": []
        }

        for grupo in grupos_materia:
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
        "alumno_matricula": alumno.matricula,
        "alumno_nombre": nombre_completo.strip().upper(),
        "alumno_cuatrimestre": perf_q,
        "carrera": nombre_carrera,
        "grupo_base_bloqueado": True,
        "grupo_base": f"{perf_q}A",
        "grupos_inscritos": grupos_inscritos,
        "materias_regulares": list(materias_regulares_dict.values()),
        "materias_recursamiento": list(materias_recursamiento_dict.values()),
        "materias_pendientes": list(materias_pendientes_dict.values())
    }

@router.post("/{matricula}/guardar")
def guardar_carga_academica(matricula: str, request: GuardarCargaRequest, db: Session = Depends(get_db)):
    perfil = db.query(StudentAcademicProfile).filter(
        StudentAcademicProfile.student_matricula == matricula
    ).order_by(StudentAcademicProfile.id.desc()).first()
    if not perfil:
        raise HTTPException(status_code=404, detail="El alumno no tiene un perfil académico activo.")

    periodo_actual = db.query(AcademicPeriod).filter(AcademicPeriod.is_active == True).first()
    if not periodo_actual:
        raise HTTPException(status_code=400, detail="No hay periodo académico activo.")

    es_maestria = perfil.nivel.name.lower() == "maestria" if perfil.nivel else False

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

    if not es_maestria:
        horarios_ocupados = []
        for grupo in grupos_a_inscribir:
            nombre_materia_actual = grupo.subject.nombre if grupo.subject else f"Grupo {grupo.id}"
            for s in grupo.schedules:
                dia_actual = DIAS_MAP.get(s.dia_semana, "Desconocido")
                ini_a = time_to_minutes(s.hora_inicio)
                fin_a = time_to_minutes(s.hora_fin)
                for o in horarios_ocupados:
                    if o['dia'].lower() == dia_actual.lower():
                        if not (fin_a <= o['inicio_min'] or ini_a >= o['fin_min']):
                            raise HTTPException(status_code=400, detail=(
                                f"Cruce de horarios el {dia_actual.capitalize()}: "
                                f"'{nombre_materia_actual}' ({s.hora_inicio.strftime('%H:%M')} a {s.hora_fin.strftime('%H:%M')}) "
                                f"choca con '{o['materia']}' ({o['inicio_txt']} a {o['fin_txt']})."
                            ))
                horarios_ocupados.append({
                    'dia': dia_actual,
                    'inicio_min': ini_a, 'fin_min': fin_a,
                    'inicio_txt': s.hora_inicio.strftime("%H:%M") if s.hora_inicio else "",
                    'fin_txt': s.hora_fin.strftime("%H:%M") if s.hora_fin else "",
                    'materia': nombre_materia_actual
                })

    try:
        inscripciones_viejas = db.query(StudentEnrollment).join(AcademicGroup).filter(
            StudentEnrollment.academic_profile_id == perfil.id,
            AcademicGroup.period_id == periodo_actual.id,
            AcademicGroup.estatus_acta != 'CERRADA'
        ).all()
        materias_viejas = [
            insc.academic_group.subject.nombre
            if insc.academic_group and insc.academic_group.subject
            else f"Grupo {insc.academic_group_id}"
            for insc in inscripciones_viejas
        ]
        old_values = {"Materias inscritas": materias_viejas}

        db.query(StudentEnrollment).filter(
            StudentEnrollment.academic_profile_id == perfil.id,
            StudentEnrollment.academic_group_id.in_(
                db.query(AcademicGroup.id).filter(
                    AcademicGroup.period_id == periodo_actual.id,
                    AcademicGroup.estatus_acta != 'CERRADA'
                )
            )
        ).delete(synchronize_session=False)

        materias_nuevas = []
        for materia in request.materias:
            nueva_inscripcion = StudentEnrollment(
                student_matricula=matricula,
                academic_profile_id=perfil.id,
                academic_group_id=materia.group_id,
                period_id=perfil.period_id,
                is_retake=materia.is_retake,
                es_adelanto=getattr(materia, 'es_adelanto', False)
            )
            db.add(nueva_inscripcion)
            grupo_obj = next((g for g in grupos_a_inscribir if g.id == materia.group_id), None)
            materia_nom = grupo_obj.subject.nombre if grupo_obj and grupo_obj.subject else f"Grupo {materia.group_id}"
            etiqueta_extra = "[ADELANTO]" if getattr(materia, 'es_adelanto', False) else ""
            materias_nuevas.append(f"{materia_nom} {etiqueta_extra}".strip())

        new_values = {"Materias inscritas": materias_nuevas}

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
    return [
        {
            "matricula": a.matricula,
            "nombre": f"{a.nombre} {a.apellido_paterno} {a.apellido_materno}".strip()
        }
        for a in alumnos
    ]


@router.get("/{matricula}/horario")
def obtener_horario_real(matricula: str, db: Session = Depends(get_db)):
    perfil = db.query(StudentAcademicProfile).filter(
        StudentAcademicProfile.student_matricula == matricula
    ).order_by(StudentAcademicProfile.id.desc()).first()
    if not perfil:
        return []

    periodo_actual = db.query(AcademicPeriod).filter(AcademicPeriod.is_active == True).first()

    query = db.query(StudentEnrollment).join(AcademicGroup).filter(
        StudentEnrollment.academic_profile_id == perfil.id,
        AcademicGroup.estatus_acta != 'CERRADA'
    )
    if periodo_actual:
        query = query.filter(AcademicGroup.period_id == periodo_actual.id)

    inscripciones = query.all()

    colores_carrera = [
        '#2563EB', '#DC2626', '#16A34A', '#D97706', '#9333EA',
        '#0891B2', '#EA580C', '#4F46E5', '#C026D3', '#4D7C0F'
    ]
    color_tronco_comun = '#475569'
    mapa_colores = {}
    idx_color = 0
    horario_formateado = []

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
            if dia_str == "MIERCOLES":
                dia_str = "MIÉRCOLES"
            if dia_str == "SABADO":
                dia_str = "SÁBADO"

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

@router.post("/{matricula}/carga-bloque-nuevo-ingreso")
def carga_bloque_nuevo_ingreso(matricula: str, db: Session = Depends(get_db)):
    alumno = db.query(Student).filter(Student.matricula == matricula).first()
    if not alumno:
        raise HTTPException(status_code=404, detail="No existe el alumno.")

    perfil = db.query(StudentAcademicProfile).filter(
        StudentAcademicProfile.student_matricula == matricula
    ).order_by(StudentAcademicProfile.id.desc()).first()
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil académico no encontrado.")

    try:
        perf_q = (
            int(perfil.quarter_actual.external_id)
            if perfil.quarter_actual and hasattr(perfil.quarter_actual, 'external_id')
            and str(perfil.quarter_actual.external_id).isdigit()
            else int(perfil.quarter_actual_id or 1)
        )
    except:
        perf_q = 1

    if perf_q != 1:
        raise HTTPException(status_code=400, detail="Este módulo es exclusivo para alumnos de Nuevo Ingreso (1er Cuatrimestre).")

    periodo_actual = db.query(AcademicPeriod).filter(AcademicPeriod.is_active == True).first()
    if not periodo_actual:
        raise HTTPException(status_code=400, detail="No hay periodo académico activo.")

    nivel_alumno = perfil.nivel.name.lower() if perfil.nivel else "licenciatura"

    materias_plan = db.query(Subject).filter(
        Subject.quarter_id == 1,
        func.lower(Subject.nivel_academico) == nivel_alumno,
        or_(Subject.career_id == perfil.career_id, Subject.career_id.is_(None))
    ).all()

    if not materias_plan:
        raise HTTPException(status_code=404, detail="No se encontraron materias de plan de estudios para esta carrera en 1er cuatrimestre.")

    grupos_finales = []
    horarios_ocupados = []
    materias_con_error = []

    for materia in materias_plan:
        grupos_ofertados = db.query(AcademicGroup).filter(
            AcademicGroup.subject_id == materia.id,
            AcademicGroup.period_id == periodo_actual.id,
            AcademicGroup.estatus_acta != 'CERRADA'
        ).all()

        grupo_valido = None
        motivo_error = "No hay grupos abiertos en este periodo"

        for grupo in grupos_ofertados:
            inscritos = db.query(StudentEnrollment).filter(
                StudentEnrollment.academic_group_id == grupo.id
            ).count()
            if inscritos >= (materia.cupo_maximo or 30):
                motivo_error = "Cupo lleno en todos los grupos"
                continue

            tiene_choque = False
            for s_nuevo in grupo.schedules:
                ini_n = time_to_minutes(s_nuevo.hora_inicio)
                fin_n = time_to_minutes(s_nuevo.hora_fin)
                dia_n = s_nuevo.dia_semana
                for o in horarios_ocupados:
                    if o['dia'] == dia_n:
                        if not (fin_n <= o['ini'] or ini_n >= o['fin']):
                            tiene_choque = True
                            motivo_error = "Conflicto de horario con otra materia asignada"
                            break
                if tiene_choque:
                    break

            if not tiene_choque:
                grupo_valido = grupo
                break

        if grupo_valido:
            for s in grupo_valido.schedules:
                horarios_ocupados.append({
                    'dia': s.dia_semana,
                    'ini': time_to_minutes(s.hora_inicio),
                    'fin': time_to_minutes(s.hora_fin)
                })
            grupos_finales.append(grupo_valido.id)
        else:
            materias_con_error.append(f"{materia.nombre} ({motivo_error})")

    if not grupos_finales:
        raise HTTPException(status_code=400, detail="No se pudo cargar ninguna materia. Razones: " + " | ".join(materias_con_error))

    try:
        db.query(StudentEnrollment).filter(
            StudentEnrollment.academic_profile_id == perfil.id,
            StudentEnrollment.period_id == periodo_actual.id
        ).delete(synchronize_session=False)

        for g_id in grupos_finales:
            db.add(StudentEnrollment(
                student_matricula=matricula,
                academic_profile_id=perfil.id,
                academic_group_id=g_id,
                period_id=periodo_actual.id,
                is_retake=False
            ))

        log_audit_event(
            db=db,
            user_identifier="SISTEMA_AUTO",
            action="CREATE",
            entity_name="student_enrollments_bloque",
            entity_id=matricula,
            old_values={},
            new_values={
                "grupos_inscritos": grupos_finales,
                "errores": materias_con_error,
                "tipo": "nuevo_ingreso"
            }
        )

        db.commit()

        mensaje = "Carga parcial completada. Faltaron algunas materias." if materias_con_error else "Carga en bloque asignada con éxito."
        return {
            "message": mensaje,
            "materias_cargadas": len(grupos_finales),
            "errores": materias_con_error
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en BD al procesar la carga: {str(e)}")