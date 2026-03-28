import json
import io
import re
import secrets
import string
import pandas as pd
import smtplib

from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from passlib.context import CryptContext
from typing import Optional

from app.models.enrollment import StudentEnrollment
from app.models.academic_group import AcademicGroup
from app.models.subject import Subject
from app.models.academic_period import AcademicPeriod
from app.schemas.enrollment import MisCalificacionesResponse
from app.db.database import get_db
from app.models.file import File as FileModel
from app.models.student import Student
from app.models.student_academic_profile import StudentAcademicProfile
from app.models.student_addresses import StudentAddress
from app.models.student_status import StudentStatus
from app.models.academic_program import AcademicProgram
from app.models.academic_level import AcademicLevel
from app.models.origin_school import OriginSchool
from app.models.grade_value import GradeValue
from app.models.student_period_gpa import StudentPeriodGpa
from sqlalchemy import case
from app.models.user import User
from app.models.role import Role
from app.schemas.student import StudentCreate, OptionsResponse
from app.core.security import get_password_hash
from app.services.audit_service import log_audit_event

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__ident="2b"
)

router = APIRouter(prefix="/alumnos", tags=["Alumnos"])

@router.get("/options", response_model=OptionsResponse)
def get_form_options(db: Session = Depends(get_db)):
    careers = db.query(AcademicProgram).all()
    schools = db.query(OriginSchool).filter(OriginSchool.is_active == True).all()
    levels = db.query(AcademicLevel).all()
    periods = db.query(AcademicPeriod).all()
    return {"careers": careers, "schools": schools, "levels": levels, "periods": periods}

@router.post("/set-base-id")
def set_base_id(nueva_matricula: str = Form(...), db: Session = Depends(get_db)):
    if not nueva_matricula.isdigit() or len(nueva_matricula) != 8:
        raise HTTPException(status_code=400, detail="La matrícula base debe tener exactamente 8 dígitos numéricos.")

    existe = db.query(Student).filter(Student.matricula == nueva_matricula).first()
    if existe:
        raise HTTPException(status_code=400, detail="Esta matrícula ya existe en el sistema.")

    try:
        career = db.query(AcademicProgram).first()
        school = db.query(OriginSchool).first()
        baja_status = db.query(StudentStatus).filter(StudentStatus.name == 'baja').first()
        period = db.query(AcademicPeriod).filter(AcademicPeriod.is_active == True).first()

        dummy_student = Student(
            matricula=nueva_matricula,
            nombre="REGISTRO",
            apellido_paterno="BASE",
            apellido_materno="SISTEMA",
            curp=f"BASE{nueva_matricula}",
            email_personal="base@sistema.com"
        )
        db.add(dummy_student)
        db.flush()

        dummy_profile = StudentAcademicProfile(
            student_matricula=dummy_student.matricula,
            nivel_id=1,
            career_id=career.id if career else 1,
            origin_school_id=school.id if school else 1,
            period_id=period.id if period else 1,
            quarter_actual_id=1,
            status_id=baja_status.id if baja_status else 2,
            promedio_procedencia=0
        )
        db.add(dummy_profile)
        db.commit()
        return {"message": f"Matrícula base actualizada correctamente a: {nueva_matricula}"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al fijar ID: {str(e)}")

@router.get("/resumen-estatus", response_model=dict)
def resumen_estatus_alumnos(db: Session = Depends(get_db)):
    resultados = (
        db.query(StudentStatus.name, func.count(StudentAcademicProfile.id))
        .join(StudentAcademicProfile, StudentAcademicProfile.status_id == StudentStatus.id)
        .group_by(StudentStatus.name)
        .all()
    )
    conteos = {nombre: total for nombre, total in resultados}
    return {
        "activo": conteos.get("activo", 0),
        "baja": conteos.get("baja", 0),
        "baja_temporal": conteos.get("baja_temporal", 0),
        "egresado": conteos.get("egresado", 0),
    }

@router.get("/listado", response_model=dict)
def listar_alumnos(
    skip: int = 0,
    limit: int = 10,
    busqueda: Optional[str] = Query(None, min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9 áéíóúÁÉÍÓÚñÑ]+$"),
    carrera_id: Optional[int] = Query(None),
    cuatrimestre: Optional[int] = Query(None),
    nivel_academico_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Student).outerjoin(StudentAcademicProfile)

    if busqueda:
        termino = f"%{busqueda}%"
        query = query.filter(
            or_(
                Student.matricula.ilike(termino),
                (Student.nombre + " " + Student.apellido_paterno + " " + Student.apellido_materno).ilike(termino)
            )
        )

    if carrera_id:
        query = query.filter(StudentAcademicProfile.career_id == carrera_id)

    if cuatrimestre:
        query = query.filter(StudentAcademicProfile.quarter_actual_id == cuatrimestre)

    if nivel_academico_id:
        query = query.filter(StudentAcademicProfile.nivel_id == nivel_academico_id)

    query = query.distinct()
    
    total = query.count()
    alumnos = query.offset(skip).limit(limit).all()

    data = []
    for alumno in alumnos:
        perfil = db.query(StudentAcademicProfile).filter(
            StudentAcademicProfile.student_matricula == alumno.matricula
        ).order_by(StudentAcademicProfile.id.desc()).first()
        
        carrera_nombre = perfil.career.name if perfil and perfil.career else "Sin Carrera"
        estatus_nombre = perfil.status.name if perfil and perfil.status else "Sin Estatus"
        nivel_nombre = perfil.nivel.name if perfil and getattr(perfil, 'nivel', None) else "Sin Nivel"
        
        data.append({
            "matricula": alumno.matricula,
            "nombre_completo": f"{alumno.nombre} {alumno.apellido_paterno} {alumno.apellido_materno or ''}".strip(),
            "carrera": carrera_nombre,
            "estatus": estatus_nombre,
            "nivel_academico": nivel_nombre 
        })

    return {"total": total, "data": data}

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_student(
    student_data: str = Form(...),
    foto_perfil: UploadFile = File(...),
    certificado: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    try:
        data_dict = json.loads(student_data)
        student_in = StudentCreate(**data_dict)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en datos: {str(e)}")

    max_m = db.query(func.max(Student.matricula)).scalar()
    final_matricula = str(int(max_m) + 1) if max_m and max_m.isdigit() else "20240001"

    alumno_existente = db.query(Student).filter(
        (Student.curp == student_in.curp) |
        (Student.email_personal == student_in.email_personal)
    ).first()

    if alumno_existente:
        if alumno_existente.curp == student_in.curp:
            raise HTTPException(status_code=400, detail="Esta CURP ya se encuentra registrada.")
        if alumno_existente.email_personal == student_in.email_personal:
            raise HTTPException(status_code=400, detail="Este correo personal ya está en uso.")

    try:
        foto_content = foto_perfil.file.read()
        foto_file = FileModel(
            file_name=foto_perfil.filename,
            mime_type=foto_perfil.content_type or "image/jpeg",
            size_bytes=len(foto_content),
            file_content=foto_content
        )
        db.add(foto_file)
        db.flush()

        cert_file_id = None
        if certificado:
            cert_content = certificado.file.read()
            cert_file = FileModel(
                file_name=certificado.filename,
                mime_type=certificado.content_type or "application/pdf",
                size_bytes=len(cert_content),
                file_content=cert_content
            )
            db.add(cert_file)
            db.flush()
            cert_file_id = cert_file.id

        new_student = Student(
            matricula=final_matricula,
            nombre=student_in.nombre,
            apellido_paterno=student_in.apellido_paterno,
            apellido_materno=student_in.apellido_materno,
            curp=student_in.curp,
            email_personal=student_in.email_personal,
            email_institucional=student_in.email_institucional,
            foto_id=foto_file.id
        )
        db.add(new_student)
        db.flush()
        
        activo_status = db.query(StudentStatus).filter(StudentStatus.name == 'activo').first()
        periodo_activo = db.query(AcademicPeriod).filter(AcademicPeriod.is_active == True).first()

        new_profile = StudentAcademicProfile(
            student_matricula=final_matricula,
            nivel_id=1,
            career_id=student_in.career_id,
            origin_school_id=student_in.origin_school_id,
            period_id=periodo_activo.id if periodo_activo else 1,
            quarter_actual_id=1,
            status_id=data_dict.get('status_id') or (activo_status.id if activo_status else 1),
            promedio_procedencia=student_in.promedio_procedencia,
            certificado_id=cert_file_id
        )
        db.add(new_profile)

        new_address = StudentAddress(
            student_matricula=final_matricula,
            calle=student_in.address.calle,
            numero_domicilio=student_in.address.numero_domicilio,
            colonia=student_in.address.colonia,
            codigo_postal=student_in.address.codigo_postal,
            municipio=student_in.address.municipio,
            estado=student_in.address.estado
        )
        db.add(new_address)

        alphabet = string.ascii_letters + string.digits
        raw_pass = ''.join(secrets.choice(alphabet) for _ in range(10))
        hashed_pw = get_password_hash(raw_pass)

        alumno_role = db.query(Role).filter(Role.name == 'alumno').first()
        new_user = User(
            identifier=final_matricula,
            email=student_in.email_personal,
            password_hash=hashed_pw,
            role_id=alumno_role.id if alumno_role else 3,
            is_temp_password=True
        )
        db.add(new_user)

        log_audit_event(
            db=db,
            user_identifier=data_dict.get('usuario_id', 'Sistema'),
            action="CREATE",
            entity_name="students",
            entity_id=final_matricula,
            old_values=None,
            new_values={"matricula": final_matricula, "nombre": student_in.nombre, "curp": student_in.curp}
        )

        db.commit()

        try:
            remitente = "sesacorp10@gmail.com"
            password_aplicacion = "enecpjvwkoseedip"
            msg = MIMEMultipart()
            msg['From'] = remitente
            msg['To'] = student_in.email_personal
            msg['Subject'] = "¡Bienvenido a SESA! Tu alta ha sido exitosa"

            cuerpo_html = f"""
            <!DOCTYPE html>
            <html>
            <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; margin: 0; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                    <div style="background-color: #4f46e5; padding: 25px; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px; color: #ffffff;">Sistema Escolar SESA</h1>
                    </div>
                    <div style="padding: 30px; color: #374151; line-height: 1.6;">
                        <h2 style="margin-top: 0; font-size: 20px; color: #111827;">¡Hola, {student_in.nombre}!</h2>
                        <p style="font-size: 16px;">Tu alta se ha procesado exitosamente.</p>
                        <div style="background-color: #f8fafc; border-left: 5px solid #4f46e5; padding: 20px; margin: 30px 0;">
                            <p style="margin: 8px 0; font-size: 16px;"><strong>Matrícula:</strong> {final_matricula}</p>
                            <p style="margin: 8px 0; font-size: 16px;"><strong>Contraseña:</strong> {raw_pass}</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
            """
            msg.attach(MIMEText(cuerpo_html, 'html'))
            server = smtplib.SMTP('smtp.gmail.com', 587)
            server.starttls()
            server.login(remitente, password_aplicacion)
            server.sendmail(remitente, student_in.email_personal, msg.as_string())
            server.quit()
        except Exception as email_err:
            pass 

        return {"status": "success", "matricula": final_matricula, "temporal_password": raw_pass}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en BD: {str(e)}")

@router.post("/importar")
async def importar_alumnos(file: UploadFile = File(...), usuario_id: str = Form("Sistema"), db: Session = Depends(get_db)):
    if not file.filename.endswith('.xlsx'):
        raise HTTPException(status_code=400, detail="Error: Solo se permiten archivos .xlsx")

    content = await file.read()
    df = pd.read_excel(io.BytesIO(content))
    df.columns = [c.replace(':', '').strip() for c in df.columns]

    registros_nuevos = 0
    credenciales_generadas = []
    errores_validacion = []

    alumno_role = db.query(Role).filter(Role.name == 'alumno').first()
    todos_estatus = db.query(StudentStatus).all()
    status_map = {s.name.lower(): s.id for s in todos_estatus}
    periodo_activo = db.query(AcademicPeriod).filter(AcademicPeriod.is_active == True).first()

    regex_solo_letras = r'^[A-Za-záéíóúÁÉÍÓÚñÑüÜ\s]+$'
    regex_curp = r'^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$'
    regex_cp = r'^\d{5}$'
    regex_email_pers = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
    regex_email_inst = r'^[a-zA-Z0-9_.+-]+@red\.unid\.mx$'

    matriculas_vistas = set()
    curps_vistos = set()
    correos_inst_vistos = set()
    correos_pers_vistos = set()

    for index, row in df.iterrows():
        fila_excel = index + 2
        errores_fila, campos_error = [], []

        matricula_str = str(row.get('Matrícula', '')).strip()
        if matricula_str.endswith('.0'): matricula_str = matricula_str[:-2]
        if not matricula_str or matricula_str == 'nan': continue

        if not re.match(r'^\d{8}$', matricula_str):
            errores_fila.append("La matrícula debe tener exactamente 8 dígitos numéricos"); campos_error.append("Matrícula")
        elif matricula_str in matriculas_vistas or db.query(Student).filter(Student.matricula == matricula_str).first():
            errores_fila.append("Matrícula duplicada"); campos_error.append("Matrícula")
        else: matriculas_vistas.add(matricula_str)

        nombre = str(row.get('Nombre', '')).strip()
        ap_pat_limpio = str(row.get('Apellido Paterno', '')).strip()
        ap_mat_limpio = str(row.get('Apellido Materno', '')).strip()

        if nombre == 'nan': nombre = ""
        if ap_pat_limpio == 'nan': ap_pat_limpio = ""
        if ap_mat_limpio == 'nan': ap_mat_limpio = ""

        if not nombre or not nombre.strip():
            errores_fila.append("Nombre vacío"); campos_error.append("Nombre")
        elif not re.match(regex_solo_letras, nombre):
            errores_fila.append("Nombre solo debe contener letras"); campos_error.append("Nombre")

        if not ap_pat_limpio or not ap_pat_limpio.strip():
            errores_fila.append("Apellido paterno vacío"); campos_error.append("Apellido Paterno")
        elif not re.match(regex_solo_letras, ap_pat_limpio):
            errores_fila.append("Apellido paterno solo debe contener letras"); campos_error.append("Apellido Paterno")

        if ap_mat_limpio and not re.match(regex_solo_letras, ap_mat_limpio):
            errores_fila.append("Apellido materno solo debe contener letras"); campos_error.append("Apellido Materno")
            
        curp_str = str(row.get('Curp', '')).strip().upper()
        if not curp_str or curp_str == 'nan' or len(curp_str) != 18 or not re.match(regex_curp, curp_str):
            errores_fila.append("CURP inválido"); campos_error.append("Curp")
        elif curp_str in curps_vistos or db.query(Student).filter(Student.curp == curp_str).first():
            errores_fila.append("CURP duplicado"); campos_error.append("Curp")
        else: curps_vistos.add(curp_str)

        email_pers = str(row.get('Correo Personal', '')).strip()
        if email_pers and email_pers != 'nan':
            if not re.match(regex_email_pers, email_pers) or email_pers in correos_pers_vistos or db.query(Student).filter(Student.email_personal == email_pers).first():
                errores_fila.append("Correo personal inválido o duplicado"); campos_error.append("Correo Personal")
            else: correos_pers_vistos.add(email_pers)

        email_inst = str(row.get('Correo Institucional', '')).strip()
        if email_inst and email_inst != 'nan':
            if not re.match(regex_email_inst, email_inst) or email_inst in correos_inst_vistos or db.query(Student).filter(Student.email_institucional == email_inst).first():
                errores_fila.append("Correo institucional inválido o duplicado (debe ser @red.unid.mx)"); campos_error.append("Correo Institucional")
            else: correos_inst_vistos.add(email_inst)

        cuat_raw = str(row.get('Cuatrimestre', '')).strip().replace('.0', '')
        cuat_val = int(cuat_raw) if cuat_raw.isdigit() else None
        if cuat_val is None or not (1 <= cuat_val <= 9):
            errores_fila.append(f"Cuatrimestre debe ser un entero entre 1 y 9 (valor: '{cuat_raw}')"); campos_error.append("Cuatrimestre")

        promedio_raw = str(row.get('Promedio General', '')).strip()
        try:
            promedio_float = float(promedio_raw)
            if promedio_float != int(promedio_float):
                errores_fila.append(f"El promedio no debe tener decimales (valor: '{promedio_raw}')"); campos_error.append("Promedio General")
            elif not (0 <= int(promedio_float) <= 10):
                errores_fila.append(f"El promedio debe estar entre 0 y 10 (valor: '{promedio_raw}')"); campos_error.append("Promedio General")
            else:
                promedio_val = int(promedio_float)
        except (ValueError, TypeError):
            errores_fila.append(f"El promedio debe ser un número (valor: '{promedio_raw}')"); campos_error.append("Promedio General")
            promedio_val = 0

        carrera_excel = str(row.get('Carrera', '')).strip()
        career = db.query(AcademicProgram).filter(AcademicProgram.codigo_unico == carrera_excel).first()
        if not career:
            errores_fila.append(f"Carrera con código '{carrera_excel}' no encontrada"); campos_error.append("Carrera")

        escuela_excel = str(row.get('Procedencia', '')).strip()
        school = db.query(OriginSchool).filter(OriginSchool.name == escuela_excel).first()
        if not school:
            errores_fila.append(f"Procedencia '{escuela_excel}' no registrada"); campos_error.append("Procedencia")

        if errores_fila:
            errores_validacion.append({"fila": fila_excel, "matricula": matricula_str, "nombre": nombre, "campos": list(set(campos_error)), "mensajes": errores_fila})
            continue

        try:
            nuevo_alumno = Student(
                matricula=matricula_str, nombre=nombre, apellido_paterno=ap_pat_limpio, apellido_materno=ap_mat_limpio,
                curp=curp_str, email_personal=email_pers,
                email_institucional=email_inst if email_inst and email_inst != 'nan' else None
            )
            db.add(nuevo_alumno)
            db.flush()

            estatus_excel = str(row.get('Estatus', 'activo')).strip().lower() if pd.notna(row.get('Estatus', 'activo')) else 'activo'

            nuevo_perfil = StudentAcademicProfile(
                student_matricula=matricula_str,
                nivel_id=1,
                career_id=career.id,
                origin_school_id=school.id,
                period_id=periodo_activo.id if periodo_activo else 1,
                quarter_actual_id=cuat_val,
                status_id=status_map.get(estatus_excel, 1),
                promedio_procedencia=promedio_val
            )
            db.add(nuevo_perfil)
            
            cp_str = str(row.get('Código Postal', '')).strip().replace('.0', '')
            nueva_direccion = StudentAddress(
                student_matricula=matricula_str, calle=str(row.get('Calle', '')).strip(),
                numero_domicilio=str(row.get('Número de domicilio') or 'S/N'), colonia=str(row.get('Colonia', '')).strip(),
                codigo_postal=cp_str, municipio=str(row.get('Municipio', '')).strip(), estado=str(row.get('Estado', 'Campeche')).strip()
            )
            db.add(nueva_direccion)

            password_aleatoria = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(10))
            nuevo_usuario = User(
                identifier=matricula_str, email=email_pers, password_hash=pwd_context.hash(password_aleatoria),
                role_id=alumno_role.id if alumno_role else 3, is_temp_password=True
            )
            db.add(nuevo_usuario)

            credenciales_generadas.append({"nombre": f"{nombre} {ap_pat_limpio}", "usuario": matricula_str, "password": password_aleatoria, "correo": email_inst if email_inst and email_inst != 'nan' else email_pers})
            db.flush()
            registros_nuevos += 1

        except Exception as e:
            db.rollback()
            errores_validacion.append({"fila": fila_excel, "matricula": matricula_str, "nombre": nombre, "campos": ["Base de Datos"], "mensajes": [f"Error al guardar: {str(e)[:100]}"]})

    if errores_validacion:
        db.rollback()
        return JSONResponse(status_code=400, content={"detail": f"Las filas {', '.join([str(e['fila']) for e in errores_validacion])} tienen errores.", "errores_detalle": errores_validacion})

    db.commit()
    return {"message": f"{registros_nuevos} alumnos creados correctamente.", "data": credenciales_generadas}

@router.get("/detalle/{matricula}")
def get_student_detail(matricula: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.matricula == matricula).first()
    if not student:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")

    perfil = db.query(StudentAcademicProfile).filter(
        StudentAcademicProfile.student_matricula == matricula
    ).order_by(StudentAcademicProfile.id.desc()).first()
    
    address = db.query(StudentAddress).filter(
        StudentAddress.student_matricula == matricula
    ).first()

    # Calcular promedio general histórico desde student_period_gpa
    promedio_general = 0.0
    if perfil:
        period_gpas = db.query(StudentPeriodGpa).filter(
            StudentPeriodGpa.academic_profile_id == perfil.id
        ).all()
        if period_gpas:
            promedio_general = round(sum(float(g.gpa) for g in period_gpas) / len(period_gpas), 2)

    return {
        "student": {
            "matricula": student.matricula,
            "nombre": student.nombre,
            "apellido_paterno": student.apellido_paterno,
            "apellido_materno": student.apellido_materno,
            "curp": student.curp,
            "email_personal": student.email_personal,
            "email_institucional": student.email_institucional,
            "career_id": perfil.career_id if perfil else None,
            "carrera_nombre": perfil.career.name if perfil and getattr(perfil, 'career', None) else "Sin Carrera",
            "origin_school_id": perfil.origin_school_id if perfil else None,
            "promedio_procedencia": perfil.promedio_procedencia if perfil else None,
            "status_id": perfil.status_id if perfil else None,
            "status": perfil.status.name if perfil and perfil.status else None,
            "foto_id": student.foto_id,
            "promedio_general": promedio_general
        },
        "address": {
            "calle": address.calle if address else '',
            "numero_domicilio": address.numero_domicilio if address else '',
            "colonia": address.colonia if address else '',
            "codigo_postal": address.codigo_postal if address else '',
            "municipio": address.municipio if address else '',
            "estado": address.estado if address else ''
        }
    }

@router.put("/actualizar/{matricula}")
def update_student(
    matricula: str,
    student_data: str = Form(...),
    foto_perfil: UploadFile = File(None),
    certificado: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    try:
        data_dict = json.loads(student_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Error en formato JSON de los datos.")

    student = db.query(Student).filter(Student.matricula == matricula).first()
    if not student:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
        
    perfil = db.query(StudentAcademicProfile).filter(StudentAcademicProfile.student_matricula == matricula).order_by(StudentAcademicProfile.id.desc()).first()
    address = db.query(StudentAddress).filter(StudentAddress.student_matricula == matricula).first()

    nueva_curp = data_dict.get('curp')
    nuevo_email = data_dict.get('email_personal')

    if db.query(Student).filter(Student.curp == nueva_curp, Student.matricula != matricula).first():
        raise HTTPException(status_code=400, detail="Esta CURP ya está registrada en otro alumno.")
    if db.query(Student).filter(Student.email_personal == nuevo_email, Student.matricula != matricula).first():
        raise HTTPException(status_code=400, detail="Este correo personal ya está en uso por otro alumno.")

    student.nombre = data_dict.get('nombre', student.nombre)
    student.apellido_paterno = data_dict.get('apellido_paterno', student.apellido_paterno)
    student.apellido_materno = data_dict.get('apellido_materno', student.apellido_materno)
    student.curp = nueva_curp
    student.email_personal = nuevo_email
    student.email_institucional = data_dict.get('email_institucional', student.email_institucional)

    if perfil:
        perfil.career_id = data_dict.get('career_id', perfil.career_id)
        perfil.origin_school_id = data_dict.get('origin_school_id', perfil.origin_school_id)

    if address:
        addr_data = data_dict.get('address', {})
        address.calle = addr_data.get('calle', address.calle)
        address.numero_domicilio = addr_data.get('numero_domicilio', address.numero_domicilio)
        address.colonia = addr_data.get('colonia', address.colonia)
        address.codigo_postal = addr_data.get('codigo_postal', address.codigo_postal)
        address.municipio = addr_data.get('municipio', address.municipio)
        address.estado = addr_data.get('estado', address.estado)

    if foto_perfil:
        foto_content = foto_perfil.file.read()
        foto_file = FileModel(file_name=foto_perfil.filename, mime_type=foto_perfil.content_type or "image/jpeg", size_bytes=len(foto_content), file_content=foto_content)
        db.add(foto_file)
        db.flush()
        student.foto_id = foto_file.id

    if certificado and perfil:
        cert_content = certificado.file.read()
        cert_file = FileModel(file_name=certificado.filename, mime_type=certificado.content_type or "application/pdf", size_bytes=len(cert_content), file_content=cert_content)
        db.add(cert_file)
        db.flush()
        perfil.certificado_id = cert_file.id

    try:
        log_audit_event(db=db, user_identifier=data_dict.get('usuario_id', 'Sistema'), action="UPDATE", entity_name="students", entity_id=matricula, old_values={}, new_values={"matricula": matricula, "actualizacion": True})
        db.commit()
        return {"status": "success", "message": "Alumno actualizado correctamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar: {str(e)}")

@router.get("/archivos/{file_id}")
def get_archivo(file_id: int, db: Session = Depends(get_db)):
    archivo = db.query(FileModel).filter(FileModel.id == file_id).first()
    if not archivo:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return Response(
        content=bytes(archivo.file_content),
        media_type=archivo.mime_type,
        headers={"Content-Disposition": f'inline; filename="{archivo.file_name}"'}
    )

@router.get("/periodos")
def get_periodos(db: Session = Depends(get_db)):
    periodos = db.query(AcademicPeriod).order_by(AcademicPeriod.codigo.desc()).all()
    return [{"period_name": p.codigo, "is_active": p.is_active} for p in periodos]

@router.get("/mis-calificaciones/{matricula}", response_model=list[MisCalificacionesResponse])
def get_my_grades(
    matricula: str,
    periodo: Optional[str] = None,
    db: Session = Depends(get_db),
):
    perfil = db.query(StudentAcademicProfile).filter(StudentAcademicProfile.student_matricula == matricula).order_by(StudentAcademicProfile.id.desc()).first()
    
    if not periodo:
        periodo_activo = db.query(AcademicPeriod).filter(AcademicPeriod.is_active == True).first()
        periodo = periodo_activo.codigo if periodo_activo else "2026-1"

    resultados = (
        db.query(
            Subject.nombre.label("materia"),
            StudentEnrollment.parcial_1_id.label("p1_id"),
            StudentEnrollment.parcial_2_id.label("p2_id"),
            StudentEnrollment.parcial_3_id.label("p3_id"),
            StudentEnrollment.calificacion_final, StudentEnrollment.status, Subject.quarter_id
        )
        .join(AcademicGroup, StudentEnrollment.academic_group_id == AcademicGroup.id)
        .join(Subject, AcademicGroup.subject_id == Subject.id)
        .join(AcademicPeriod, AcademicGroup.period_id == AcademicPeriod.id)
        .filter(
            StudentEnrollment.student_matricula == matricula,
            AcademicPeriod.codigo == periodo,
        )
    ).all()

    carrera = perfil.career.name if perfil and perfil.career else "N/A"
    
    val_map = {gv.id: str(gv.value) for gv in db.query(GradeValue).all()}

    return [
        MisCalificacionesResponse(
            materia=r.materia,
            carrera=carrera,
            cuatrimestre=str(r.quarter_id) if r.quarter_id else "1",
            parcial_1=val_map.get(r.p1_id) if hasattr(r, 'p1_id') else None,
            parcial_2=val_map.get(r.p2_id) if hasattr(r, 'p2_id') else None,
            parcial_3=val_map.get(r.p3_id) if hasattr(r, 'p3_id') else None,
            calificacion_final=r.calificacion_final,
            status=r.status,
        )
        for r in resultados
    ]

@router.post("/calcular-gpas", response_model=dict)
def calcular_gpas(period_id: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Calcula y persiste el GPA por alumno/periodo en student_period_gpa.
    Solo considera calificaciones de grupos con estatus_acta = 'CERRADA'.
    Si se pasa period_id recalcula solo ese periodo; si no, recalcula todos.
    """
    query = (
        db.query(
            StudentEnrollment.academic_profile_id,
            StudentEnrollment.period_id,
            func.round(func.avg(StudentEnrollment.calificacion_final), 2).label("gpa"),
            func.count(StudentEnrollment.id).label("total"),
            func.sum(case((StudentEnrollment.status == 'aprobada', 1), else_=0)).label("aprobadas"),
            func.sum(case((StudentEnrollment.status == 'reprobada', 1), else_=0)).label("reprobadas"),
        )
        .join(AcademicGroup, StudentEnrollment.academic_group_id == AcademicGroup.id)
        .filter(
            AcademicGroup.estatus_acta == 'CERRADA',
            StudentEnrollment.calificacion_final.isnot(None),
        )
        .group_by(StudentEnrollment.academic_profile_id, StudentEnrollment.period_id)
    )

    if period_id:
        query = query.filter(StudentEnrollment.period_id == period_id)

    resultados = query.all()

    upserted = 0
    for r in resultados:
        existing = db.query(StudentPeriodGpa).filter(
            StudentPeriodGpa.academic_profile_id == r.academic_profile_id,
            StudentPeriodGpa.period_id == r.period_id,
        ).first()

        if existing:
            existing.gpa = float(r.gpa)
            existing.total_subjects = r.total
            existing.approved_subjects = int(r.aprobadas or 0)
            existing.failed_subjects = int(r.reprobadas or 0)
        else:
            db.add(StudentPeriodGpa(
                academic_profile_id=r.academic_profile_id,
                period_id=r.period_id,
                gpa=float(r.gpa),
                total_subjects=r.total,
                approved_subjects=int(r.aprobadas or 0),
                failed_subjects=int(r.reprobadas or 0),
            ))
        upserted += 1

    db.commit()
    return {"message": f"GPA calculado para {upserted} registros.", "total": upserted}


@router.get("/historial-gpa/{matricula}", response_model=list)
def get_historial_gpa(matricula: str, db: Session = Depends(get_db)):
    """
    Retorna el historial de GPAs por periodo para un alumno.
    """
    perfil = (
        db.query(StudentAcademicProfile)
        .filter(StudentAcademicProfile.student_matricula == matricula)
        .order_by(StudentAcademicProfile.id.desc())
        .first()
    )
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil académico no encontrado.")

    registros = (
        db.query(StudentPeriodGpa, AcademicPeriod.codigo)
        .join(AcademicPeriod, StudentPeriodGpa.period_id == AcademicPeriod.id)
        .filter(StudentPeriodGpa.academic_profile_id == perfil.id)
        .order_by(AcademicPeriod.fecha_inicio.asc())
        .all()
    )

    return [
        {
            "periodo": codigo,
            "gpa": float(gpa_rec.gpa),
            "total_materias": gpa_rec.total_subjects,
            "aprobadas": gpa_rec.approved_subjects,
            "reprobadas": gpa_rec.failed_subjects,
            "calculado_en": gpa_rec.calculated_at.isoformat() if gpa_rec.calculated_at else None,
        }
        for gpa_rec, codigo in registros
    ]


@router.get("/{matricula}/kardex", response_model=dict)
def get_kardex(matricula: str, db: Session = Depends(get_db)):
    alumno = db.query(Student).filter(Student.matricula == matricula).first()
    if not alumno:
        raise HTTPException(status_code=404, detail="Alumno no encontrado.")

    perfil = (
        db.query(StudentAcademicProfile)
        .filter(StudentAcademicProfile.student_matricula == matricula)
        .order_by(StudentAcademicProfile.id.desc())
        .first()
    )

    carrera = perfil.career.name if perfil and perfil.career else "N/A"
    nivel = perfil.nivel.name if perfil and getattr(perfil, 'nivel', None) else "Licenciatura"

    # Todas las inscripciones con acta cerrada, ordenadas por periodo
    inscripciones = (
        db.query(
            AcademicPeriod.codigo.label("periodo"),
            AcademicPeriod.fecha_inicio.label("fecha_inicio"),
            Subject.nombre.label("materia"),
            Subject.creditos.label("creditos"),
            StudentEnrollment.calificacion_final.label("calificacion_final"),
            StudentEnrollment.status.label("status"),
            StudentEnrollment.is_retake.label("is_retake"),
        )
        .join(AcademicGroup, StudentEnrollment.academic_group_id == AcademicGroup.id)
        .join(Subject, AcademicGroup.subject_id == Subject.id)
        .join(AcademicPeriod, AcademicGroup.period_id == AcademicPeriod.id)
        .filter(
            StudentEnrollment.student_matricula == matricula,
            AcademicGroup.estatus_acta == 'CERRADA',
            StudentEnrollment.calificacion_final.isnot(None),
        )
        .order_by(AcademicPeriod.fecha_inicio.asc(), Subject.nombre.asc())
        .all()
    )

    # Agrupar por periodo
    periodos_dict = {}
    for r in inscripciones:
        if r.periodo not in periodos_dict:
            periodos_dict[r.periodo] = {"periodo": r.periodo, "materias": []}
        periodos_dict[r.periodo]["materias"].append({
            "materia": r.materia,
            "creditos": r.creditos or 0,
            "calificacion_final": r.calificacion_final,
            "status": r.status,
            "is_retake": r.is_retake or False,
        })

    periodos = list(periodos_dict.values())

    # Indicadores acumulados
    todas = [r for p in periodos for r in p["materias"]]
    total_creditos = sum(m["creditos"] for m in todas if m["status"] == "aprobada")
    califs = [m["calificacion_final"] for m in todas if m["calificacion_final"] is not None]
    promedio_general = round(sum(califs) / len(califs), 2) if califs else 0

    return {
        "matricula": matricula,
        "nombre_completo": f"{alumno.nombre} {alumno.apellido_paterno} {alumno.apellido_materno or ''}".strip(),
        "carrera": carrera,
        "nivel": nivel,
        "periodos": periodos,
        "total_creditos_acumulados": total_creditos,
        "promedio_general": promedio_general,
    }
