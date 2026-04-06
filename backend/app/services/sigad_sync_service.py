import os
import secrets
import string
import smtplib
import requests
from datetime import date, timedelta, time as dt_time

from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.orm import Session
from sqlalchemy import update

from app.models.classroom import Classroom
from app.models.academic_period import AcademicPeriod
from app.models.academic_program import AcademicProgram
from app.models.quarter_catalog import QuarterCatalog
from app.models.teacher import Teacher
from app.models.user import User
from app.models.role import Role
from app.models.subject import Subject
from app.models.sigad_group import SigadGroup
from app.models.academic_group import AcademicGroup
from app.models.assignment_schedule import AssignmentSchedule
from dotenv import load_dotenv
from app.core.security import get_password_hash

load_dotenv()

SIGAD_BASE_URL = os.getenv("SIGAD_BASE_URL", "http://100.106.18.8:3000")
SIGAD_TIMEOUT = 30


def _new_result():
    return {"inserted": 0, "updated": 0, "errors": 0, "error_details": []}


def _time_to_str(value) -> str | None:
    """Normaliza un valor de tiempo (timedelta, time o string) a 'HH:MM:SS' para comparar."""
    if value is None:
        return None
    if isinstance(value, timedelta):
        total = int(value.total_seconds())
        h, rem = divmod(total, 3600)
        m, s = divmod(rem, 60)
        return f"{h:02}:{m:02}:{s:02}"
    if isinstance(value, dt_time):
        return value.strftime("%H:%M:%S")
    # String: puede venir como "8:00", "08:00", "8:00:00", "08:00:00", "08:00:00.000"
    parts = str(value).strip().split(":")
    h = int(parts[0]) if len(parts) > 0 else 0
    m = int(parts[1]) if len(parts) > 1 else 0
    s = int(float(parts[2])) if len(parts) > 2 else 0
    return f"{h:02}:{m:02}:{s:02}"


def _parse_date(value) -> date | None:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def _apply_changes(obj, **fields) -> bool:
    """Asigna los campos al objeto solo si cambiaron. Retorna True si hubo al menos un cambio."""
    changed = False
    for attr, value in fields.items():
        if getattr(obj, attr) != value:
            setattr(obj, attr, value)
            changed = True
    return changed


def _fetch_sigad(endpoint: str):
    url = f"{SIGAD_BASE_URL}{endpoint}"
    resp = requests.get(url, timeout=SIGAD_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def _resolve_fk(db: Session, model, external_id_value):
    if external_id_value is None:
        return None
    row = db.query(model.id).filter(model.external_id == external_id_value).first()
    return row[0] if row else None


def _sync_classrooms(db: Session) -> dict:
    result = _new_result()
    try:
        data = _fetch_sigad("/api/aulas/catalogo")
    except Exception as e:
        result["errors"] += 1
        result["error_details"].append(f"Error al conectar con SIGAD (aulas): {e}")
        return result

    items = data if isinstance(data, list) else data.get("data", data.get("aulas", []))

    for item in items:
        try:
            ext_id = item["id_aula"]
            existing = db.query(Classroom).filter(Classroom.external_id == ext_id).first()
            if existing:
                if _apply_changes(existing,
                    nombre_codigo=item["nombre_codigo"],
                    capacidad=item["capacidad"],
                    tipo=item["tipo"],
                ):
                    result["updated"] += 1
            else:
                db.add(Classroom(
                    external_id=ext_id,
                    nombre_codigo=item["nombre_codigo"],
                    capacidad=item["capacidad"],
                    tipo=item["tipo"],
                ))
                result["inserted"] += 1
        except Exception as e:
            result["errors"] += 1
            result["error_details"].append(f"Error al procesar aula id_aula={item.get('id_aula')}: {e}")

    db.flush()
    return result


def _sync_periods(db: Session) -> dict:
    result = _new_result()
    try:
        data = _fetch_sigad("/api/periodos/activo")
    except Exception as e:
        result["errors"] += 1
        result["error_details"].append(f"Error al conectar con SIGAD (periodos): {e}")
        return result

    item = data if isinstance(data, dict) and "id_periodo" in data else (data[0] if isinstance(data, list) and data else None)
    if not item:
        if isinstance(data, dict):
            item = data.get("data", data.get("periodo", None))
        if not item:
            result["errors"] += 1
            result["error_details"].append("Respuesta vacía o inesperada de SIGAD para periodos")
            return result

    try:
        db.execute(update(AcademicPeriod).where(AcademicPeriod.is_active == True).values(is_active=False))

        ext_id = item["id_periodo"]
        existing = db.query(AcademicPeriod).filter(AcademicPeriod.external_id == ext_id).first()
        if existing:
            existing.is_active = True  # siempre se reactiva, no cuenta como cambio de datos
            if _apply_changes(existing,
                codigo=item["codigo"],
                anio=item.get("anio"),
                fecha_inicio=_parse_date(item["fecha_inicio"]),
                fecha_fin=_parse_date(item["fecha_fin"]),
                fecha_limite_calif=_parse_date(item.get("fecha_limite_calif")),
            ):
                result["updated"] += 1
        else:
            db.add(AcademicPeriod(
                external_id=ext_id,
                codigo=item["codigo"],
                anio=item.get("anio"),
                fecha_inicio=item["fecha_inicio"],
                fecha_fin=item["fecha_fin"],
                fecha_limite_calif=item.get("fecha_limite_calif"),
                is_active=True,
            ))
            result["inserted"] += 1
        db.flush()
    except Exception as e:
        result["errors"] += 1
        result["error_details"].append(f"Error al procesar periodo id_periodo={item.get('id_periodo')}: {e}")

    return result


def _sync_programs(db: Session) -> dict:
    result = _new_result()
    try:
        data = _fetch_sigad("/api/carreras/programas_academicos")
    except Exception as e:
        result["errors"] += 1
        result["error_details"].append(f"Error al conectar con SIGAD (programas): {e}")
        return result

    items = data if isinstance(data, list) else data.get("data", data.get("programas", []))

    for item in items:
        try:
            ext_id = item["id_programa_academico"]
            existing = db.query(AcademicProgram).filter(AcademicProgram.external_id == ext_id).first()
            if existing:
                if _apply_changes(existing,
                    codigo_unico=item.get("codigo_unico"),
                    name=item["nombre_programa"],
                    modalidad=item.get("modalidad"),
                    nivel_academico=item.get("nivel_academico"),
                ):
                    result["updated"] += 1
            else:
                db.add(AcademicProgram(
                    external_id=ext_id,
                    codigo_unico=item.get("codigo_unico"),
                    name=item["nombre_programa"],
                    modalidad=item.get("modalidad"),
                    nivel_academico=item.get("nivel_academico"),
                ))
                result["inserted"] += 1
        except Exception as e:
            result["errors"] += 1
            result["error_details"].append(f"Error al procesar programa id={item.get('id_programa_academico')}: {e}")

    db.flush()
    return result


def _sync_quarters(db: Session) -> dict:
    result = _new_result()
    try:
        data = _fetch_sigad("/api/cuatrimestres/catalogo")
    except Exception as e:
        result["errors"] += 1
        result["error_details"].append(f"Error al conectar con SIGAD (cuatrimestres): {e}")
        return result

    items = data if isinstance(data, list) else data.get("data", data.get("cuatrimestres", []))

    for item in items:
        try:
            ext_id = item["id_cuatrimestre"]
            existing = db.query(QuarterCatalog).filter(QuarterCatalog.external_id == ext_id).first()
            if existing:
                if _apply_changes(existing, nombre=item["nombre"]):
                    result["updated"] += 1
            else:
                db.add(QuarterCatalog(
                    external_id=ext_id,
                    nombre=item["nombre"],
                ))
                result["inserted"] += 1
        except Exception as e:
            result["errors"] += 1
            result["error_details"].append(f"Error al procesar cuatrimestre id={item.get('id_cuatrimestre')}: {e}")

    db.flush()
    return result


def _send_teacher_welcome_email(nombre: str, matricula: str, raw_password: str, email_dest: str):
    try:
        remitente = "sesacorp10@gmail.com"
        password_aplicacion = "enecpjvwkoseedip"

        msg = MIMEMultipart()
        msg["From"] = remitente
        msg["To"] = email_dest
        msg["Subject"] = "¡Bienvenido a SESA! Tu cuenta de docente ha sido creada"

        cuerpo_html = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; margin: 0; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                <div style="background-color: #4f46e5; padding: 25px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; color: #ffffff;">Sistema Escolar SESA</h1>
                </div>
                <div style="padding: 30px; color: #374151; line-height: 1.6;">
                    <h2 style="margin-top: 0; font-size: 20px; color: #111827;">¡Hola, {nombre}!</h2>
                    <p style="font-size: 16px;">Tu cuenta de docente ha sido creada exitosamente en el sistema SESA.</p>
                    <div style="background-color: #f8fafc; border-left: 5px solid #4f46e5; padding: 20px; margin: 30px 0;">
                        <p style="margin: 8px 0; font-size: 16px;"><strong>Usuario:</strong> {matricula}</p>
                        <p style="margin: 8px 0; font-size: 16px;"><strong>Contraseña temporal:</strong> {raw_password}</p>
                    </div>
                    <p style="font-size: 14px; color: #6b7280;">Al iniciar sesión por primera vez, el sistema te pedirá cambiar tu contraseña.</p>
                </div>
                <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">Este es un correo automático del sistema SESA.</p>
                </div>
            </div>
        </body>
        </html>
        """
        msg.attach(MIMEText(cuerpo_html, "html"))
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(remitente, password_aplicacion)
        server.sendmail(remitente, email_dest, msg.as_string())
        server.quit()
        return None
    except Exception as e:
        return str(e)


def _sync_teachers(db: Session) -> tuple[dict, dict]:
    t_result = _new_result()
    u_result = _new_result()
    u_result["nuevos_docentes"] = []

    try:
        data = _fetch_sigad("/api/docentes/catalogo")
    except Exception as e:
        t_result["errors"] += 1
        t_result["error_details"].append(f"Error al conectar con SIGAD (docentes): {e}")
        return t_result, u_result

    items = data if isinstance(data, list) else data.get("data", data.get("docentes", []))

    docente_role = db.query(Role).filter(Role.name == "docente").first()
    role_id = docente_role.id if docente_role else 2

    matriculas_sigad = {item.get("matricula_empleado") for item in items if item.get("matricula_empleado")}

    for item in items:
        matricula_emp = item.get("matricula_empleado")
        try:
            usuario_id = item.get("usuario_id")
            user_data = {}
            if usuario_id:
                try:
                    user_data = _fetch_sigad(f"/api/users/catalogo/{usuario_id}")
                    if isinstance(user_data, list) and user_data:
                        user_data = user_data[0]
                    elif isinstance(user_data, dict) and "data" in user_data:
                        user_data = user_data["data"]
                except Exception as e:
                    t_result["error_details"].append(
                        f"Error al obtener datos de usuario_id={usuario_id} para docente {matricula_emp}: {e}"
                    )

            nombre = user_data.get("nombres", "")
            apellido_paterno = user_data.get("apellido_paterno", "")
            apellido_materno = user_data.get("apellido_materno", "")
            email_personal = user_data.get("personal_email", "")
            email_institucional = user_data.get("institutional_email")

            existing = db.query(Teacher).filter(Teacher.matricula_empleado == matricula_emp).first()
            if existing:
                fields = dict(
                    sigad_docente_id=item.get("id_docente"),
                    sigad_usuario_id=usuario_id,
                    email_institucional=email_institucional,
                    nivel_academico=item.get("nivel_academico"),
                    is_active=True,
                )
                if nombre:
                    fields["nombre"] = nombre
                if apellido_paterno:
                    fields["apellido_paterno"] = apellido_paterno
                if apellido_materno:
                    fields["apellido_materno"] = apellido_materno
                if email_personal:
                    fields["email_personal"] = email_personal
                if _apply_changes(existing, **fields):
                    t_result["updated"] += 1
            else:
                db.add(Teacher(
                    matricula_empleado=matricula_emp,
                    sigad_docente_id=item.get("id_docente"),
                    sigad_usuario_id=usuario_id,
                    nombre=nombre or matricula_emp,
                    apellido_paterno=apellido_paterno or "",
                    apellido_materno=apellido_materno or "",
                    email_personal=email_personal or f"{matricula_emp}@placeholder.com",
                    email_institucional=email_institucional,
                    nivel_academico=item.get("nivel_academico"),
                    is_active=True,
                ))
                t_result["inserted"] += 1

            existing_user = db.query(User).filter(User.identifier == matricula_emp).first()
            if not existing_user:
                email_para_cuenta = email_institucional or email_personal
                if not email_para_cuenta:
                    u_result["errors"] += 1
                    u_result["error_details"].append(
                        f"Docente {matricula_emp}: sin correo disponible para crear cuenta"
                    )
                    continue

                email_en_uso = db.query(User).filter(User.email == email_para_cuenta).first()
                if email_en_uso:
                    u_result["errors"] += 1
                    u_result["error_details"].append(
                        f"Docente {matricula_emp}: el correo {email_para_cuenta} ya está en uso por otro usuario"
                    )
                    continue

                alphabet = string.ascii_letters + string.digits
                raw_pass = "".join(secrets.choice(alphabet) for _ in range(10))
                hashed_pw = get_password_hash(raw_pass)

                db.add(User(
                    identifier=matricula_emp,
                    email=email_para_cuenta,
                    password_hash=hashed_pw,
                    role_id=role_id,
                    is_temp_password=True,
                ))
                db.flush()
                u_result["inserted"] += 1

                nombre_display = nombre or matricula_emp
                err = _send_teacher_welcome_email(nombre_display, matricula_emp, raw_pass, email_para_cuenta)

                nombre_completo = " ".join(filter(None, [nombre, apellido_paterno, apellido_materno])).strip() or matricula_emp
                u_result["nuevos_docentes"].append({
                    "matricula": matricula_emp,
                    "nombre": nombre_completo,
                    "email": email_para_cuenta,
                    "correo_enviado": err is None,
                })

                if err:
                    u_result["error_details"].append(
                        f"Cuenta creada para {matricula_emp} pero falló envío de correo: {err}"
                    )

        except Exception as e:
            t_result["errors"] += 1
            t_result["error_details"].append(f"Error al procesar docente {matricula_emp}: {e}")

    docentes_locales = db.query(Teacher).filter(Teacher.is_active == True).all()
    for docente in docentes_locales:
        if docente.matricula_empleado not in matriculas_sigad:
            docente.is_active = False
            t_result["error_details"].append(
                f"Docente {docente.matricula_empleado} marcado como inactivo (ya no está en SIGAD)"
            )

    db.flush()
    return t_result, u_result


def _sync_subjects(db: Session) -> dict:
    result = _new_result()
    try:
        data = _fetch_sigad("/api/materias/catalogo")
    except Exception as e:
        result["errors"] += 1
        result["error_details"].append(f"Error al conectar con SIGAD (materias): {e}")
        return result

    items = data if isinstance(data, list) else data.get("data", data.get("materias", []))

    for item in items:
        try:
            ext_id = item["id_materia"]
            period_id = _resolve_fk(db, AcademicPeriod, item.get("id_periodo"))
            quarter_id = _resolve_fk(db, QuarterCatalog, item.get("cuatrimestre_id"))

            career_id = None
            id_prog = item.get("id_programa_academico")
            if id_prog:
                career_id = _resolve_fk(db, AcademicProgram, id_prog)

            existing = db.query(Subject).filter(Subject.external_id == ext_id).first()
            if existing:
                if _apply_changes(existing,
                    codigo_unico=item.get("codigo_unico"),
                    nombre=item["nombre"],
                    period_id=period_id,
                    quarter_id=quarter_id,
                    creditos=item.get("creditos", 0),
                    cupo_maximo=item.get("cupo_maximo"),
                    tipo_asignatura=item.get("tipo_asignatura"),
                    nivel_academico=item.get("nivel_academico"),
                    career_id=career_id,
                ):
                    result["updated"] += 1
            else:
                db.add(Subject(
                    external_id=ext_id,
                    codigo_unico=item.get("codigo_unico"),
                    nombre=item["nombre"],
                    period_id=period_id,
                    quarter_id=quarter_id,
                    creditos=item.get("creditos", 0),
                    cupo_maximo=item.get("cupo_maximo"),
                    tipo_asignatura=item.get("tipo_asignatura"),
                    nivel_academico=item.get("nivel_academico"),
                    career_id=career_id,
                ))
                result["inserted"] += 1
        except Exception as e:
            result["errors"] += 1
            result["error_details"].append(f"Error al procesar materia id_materia={item.get('id_materia')}: {e}")

    db.flush()
    return result


def _sync_sigad_groups(db: Session) -> dict:
    result = _new_result()
    try:
        data = _fetch_sigad("/api/grupos/catalogo")
    except Exception as e:
        result["errors"] += 1
        result["error_details"].append(f"Error al conectar con SIGAD (grupos): {e}")
        return result

    items = data if isinstance(data, list) else data.get("data", data.get("grupos", []))

    for item in items:
        try:
            ext_id = item["id_grupo"]
            career_id = _resolve_fk(db, AcademicProgram, item.get("id_programa_academico"))
            quarter_id = _resolve_fk(db, QuarterCatalog, item.get("cuatrimestre_id"))

            if career_id is None:
                result["errors"] += 1
                result["error_details"].append(
                    f"Grupo id_grupo={ext_id}: FK career_id no encontrada para id_programa_academico={item.get('id_programa_academico')}"
                )
                continue
            if quarter_id is None:
                result["errors"] += 1
                result["error_details"].append(
                    f"Grupo id_grupo={ext_id}: FK quarter_id no encontrada para cuatrimestre_id={item.get('cuatrimestre_id')}"
                )
                continue

            existing = db.query(SigadGroup).filter(SigadGroup.external_id == ext_id).first()
            if existing:
                if _apply_changes(existing,
                    identificador=item["identificador"],
                    nivel_academico=item.get("nivel_academico"),
                    career_id=career_id,
                    quarter_id=quarter_id,
                ):
                    result["updated"] += 1
            else:
                db.add(SigadGroup(
                    external_id=ext_id,
                    identificador=item["identificador"],
                    nivel_academico=item.get("nivel_academico"),
                    career_id=career_id,
                    quarter_id=quarter_id,
                ))
                result["inserted"] += 1
        except Exception as e:
            result["errors"] += 1
            result["error_details"].append(f"Error al procesar grupo id_grupo={item.get('id_grupo')}: {e}")

    db.flush()
    return result


def _sync_academic_groups(db: Session) -> tuple[dict, dict]:
    ag_result = _new_result()
    as_result = _new_result()

    try:
        data = _fetch_sigad("/api/asignaciones/catalogo")
    except Exception as e:
        ag_result["errors"] += 1
        ag_result["error_details"].append(f"Error al conectar con SIGAD (asignaciones): {e}")
        return ag_result, as_result

    items = data if isinstance(data, list) else data.get("data", data.get("asignaciones", []))

    grouped: dict[int, list] = {}
    for item in items:
        asig_id = item.get("id_asignacion")
        if asig_id is not None:
            grouped.setdefault(asig_id, []).append(item)

    for ext_id, rows in grouped.items():
        first = rows[0]
        try:
            subject_id = _resolve_fk(db, Subject, first.get("materia_id"))
            if subject_id is None:
                ag_result["errors"] += 1
                ag_result["error_details"].append(
                    f"Asignación id={ext_id}: FK subject_id no encontrada para materia_id={first.get('materia_id')}"
                )
                continue

            docente_sigad_id = first.get("docente_id")
            teacher = db.query(Teacher).filter(Teacher.sigad_docente_id == docente_sigad_id).first() if docente_sigad_id else None
            if teacher is None:
                ag_result["errors"] += 1
                ag_result["error_details"].append(
                    f"Asignación id={ext_id}: FK teacher_id no encontrada para docente_id={docente_sigad_id}"
                )
                continue

            period_id = _resolve_fk(db, AcademicPeriod, first.get("periodo_id"))
            if period_id is None:
                ag_result["errors"] += 1
                ag_result["error_details"].append(
                    f"Asignación id={ext_id}: FK period_id no encontrada para periodo_id={first.get('periodo_id')}"
                )
                continue

            sigad_group_id = _resolve_fk(db, SigadGroup, first.get("grupo_id"))
            aula_id = _resolve_fk(db, Classroom, first.get("aula_id"))

            existing = db.query(AcademicGroup).filter(AcademicGroup.external_id == ext_id).first()
            if existing:
                if _apply_changes(existing,
                    subject_id=subject_id,
                    teacher_id=teacher.id,
                    sigad_group_id=sigad_group_id,
                    aula_id=aula_id,
                    period_id=period_id,
                ):
                    ag_result["updated"] += 1
                ag_internal_id = existing.id
            else:
                new_ag = AcademicGroup(
                    external_id=ext_id,
                    subject_id=subject_id,
                    teacher_id=teacher.id,
                    sigad_group_id=sigad_group_id,
                    aula_id=aula_id,
                    period_id=period_id,
                    estatus_acta="ABIERTA",
                    tiene_reporte_externo=False,
                )
                db.add(new_ag)
                db.flush()
                ag_internal_id = new_ag.id
                ag_result["inserted"] += 1

            # Construir el set de horarios nuevos (normalizados)
            new_schedules = set()
            for row in rows:
                dia = row.get("dia_semana")
                h_inicio = row.get("hora_inicio")
                h_fin = row.get("hora_fin")
                if dia is None or h_inicio is None:
                    continue
                new_schedules.add((int(dia), _time_to_str(h_inicio), _time_to_str(h_fin)))

            # Construir el set de horarios existentes en BD
            existing_schedules = set()
            for s in db.query(AssignmentSchedule).filter(
                AssignmentSchedule.academic_group_id == ag_internal_id
            ).all():
                existing_schedules.add((int(s.dia_semana), _time_to_str(s.hora_inicio), _time_to_str(s.hora_fin)))

            if new_schedules == existing_schedules:
                continue

            # Hay cambios: eliminar y reinsertar
            db.query(AssignmentSchedule).filter(
                AssignmentSchedule.academic_group_id == ag_internal_id
            ).delete(synchronize_session=False)

            added = new_schedules - existing_schedules
            for row in rows:
                try:
                    dia = row.get("dia_semana")
                    h_inicio = row.get("hora_inicio")
                    h_fin = row.get("hora_fin")
                    if dia is None or h_inicio is None:
                        continue
                    db.add(AssignmentSchedule(
                        academic_group_id=ag_internal_id,
                        dia_semana=dia,
                        hora_inicio=h_inicio,
                        hora_fin=h_fin,
                    ))
                    if (dia, _time_to_str(h_inicio), _time_to_str(h_fin)) in added:
                        as_result["inserted"] += 1
                    else:
                        as_result["updated"] += 1
                except Exception as e:
                    as_result["errors"] += 1
                    as_result["error_details"].append(
                        f"Error en horario de asignación id={ext_id}, dia={row.get('dia_semana')}: {e}"
                    )

        except Exception as e:
            ag_result["errors"] += 1
            ag_result["error_details"].append(f"Error al procesar asignación id={ext_id}: {e}")

    db.flush()
    return ag_result, as_result


def _commit(db: Session, resumen: dict, key: str):
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        if key in resumen:
            if isinstance(resumen[key], dict):
                resumen[key].setdefault("error_details", []).append(f"Error al hacer commit: {e}")


SIGAD_HEALTH_TIMEOUT = 5


def _sigad_disponible() -> tuple[bool, str]:
    try:
        resp = requests.get(f"{SIGAD_BASE_URL}/api/health", timeout=SIGAD_HEALTH_TIMEOUT)
        if resp.ok:
            return True, ""
        return False, f"SIGAD respondió con status {resp.status_code}"
    except requests.exceptions.ConnectionError:
        return False, "No se pudo conectar con SIGAD (connection refused o host inaccesible)"
    except requests.exceptions.Timeout:
        return False, f"SIGAD no respondió en {SIGAD_HEALTH_TIMEOUT} segundos"
    except Exception as e:
        return False, f"Error al verificar disponibilidad de SIGAD: {e}"


def sincronizar_todo(db: Session) -> dict:
    resumen = {}

    disponible, motivo = _sigad_disponible()
    if not disponible:
        return {"error": f"Sincronización cancelada: {motivo}"}

    resumen["classrooms"] = _sync_classrooms(db)
    _commit(db, resumen, "classrooms")

    resumen["academic_periods"] = _sync_periods(db)
    _commit(db, resumen, "academic_periods")

    resumen["academic_programs"] = _sync_programs(db)
    _commit(db, resumen, "academic_programs")

    resumen["quarter_catalog"] = _sync_quarters(db)
    _commit(db, resumen, "quarter_catalog")

    t_res, u_res = _sync_teachers(db)
    resumen["teachers"] = t_res
    resumen["users_created"] = u_res
    _commit(db, resumen, "teachers")

    resumen["subjects"] = _sync_subjects(db)
    _commit(db, resumen, "subjects")

    resumen["sigad_groups"] = _sync_sigad_groups(db)
    _commit(db, resumen, "sigad_groups")

    ag_res, as_res = _sync_academic_groups(db)
    resumen["academic_groups"] = ag_res
    resumen["assignment_schedules"] = as_res
    _commit(db, resumen, "academic_groups")

    return resumen
