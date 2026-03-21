import json
import io
import re
import secrets
import string
import bcrypt
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
from app.models.student_addresses import StudentAddress
from app.models.student_status import StudentStatus
from app.models.career import Career
from app.models.origin_school import OriginSchool
from app.models.user import User
from app.models.role import Role
from app.schemas.student import StudentCreate, OptionsResponse
from app.core.security import get_password_hash

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__ident="2b"
)

router = APIRouter(prefix="/alumnos", tags=["Alumnos"])


@router.get("/options", response_model=OptionsResponse)
def get_form_options(db: Session = Depends(get_db)):
    careers = db.query(Career).all()
    schools = db.query(OriginSchool).filter(OriginSchool.is_active == True).all()
    return {"careers": careers, "schools": schools}


# ENDPOINT: CONFIGURAR MATRÍCULA BASE
@router.post("/set-base-id")
def set_base_id(nueva_matricula: str = Form(...), db: Session = Depends(get_db)):
    # 1. Validación estricta: Exactamente 8 dígitos numéricos
    if not nueva_matricula.isdigit() or len(nueva_matricula) != 8:
        raise HTTPException(status_code=400, detail="La matrícula base debe tener exactamente 8 dígitos numéricos.")

    existe = db.query(Student).filter(Student.matricula == nueva_matricula).first()
    if existe:
        raise HTTPException(status_code=400, detail="Esta matrícula ya existe en el sistema.")

    try:
        career = db.query(Career).first()
        school = db.query(OriginSchool).first()

        baja_status = db.query(StudentStatus).filter(StudentStatus.name == 'baja').first()
        dummy_student = Student(
            matricula=nueva_matricula,
            nombre="REGISTRO",
            apellido_paterno="BASE",
            apellido_materno="SISTEMA",
            curp=f"BASE{nueva_matricula}",
            email_personal="base@sistema.com",
            promedio_procedencia=0,
            career_id=career.id if career else 1,
            origin_school_id=school.id if school else 1,
            cuatrimestre_actual=1,
            status_id=baja_status.id if baja_status else 2
        )
        db.add(dummy_student)
        db.commit()
        return {"message": f"Matrícula base actualizada correctamente a: {nueva_matricula}"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al fijar ID: {str(e)}")


# ENDPOINT: REGISTRO MANUAL

# --- ENDPOINT DE LISTADO DE JORGE ---
@router.get("/listado", response_model=dict)
def listar_alumnos(
    skip: int = 0,
    limit: int = 10,
    busqueda: Optional[str] = Query(
        None,
        min_length=3,
        max_length=50,
        description="Búsqueda por matrícula o nombre",
        pattern=r"^[a-zA-Z0-9 áéíóúÁÉÍÓÚñÑ]+$"
    ),
    carrera_id: Optional[int] = Query(None, description="ID de la carrera a filtrar"),
    cuatrimestre: Optional[int] = Query(None, description="Número de cuatrimestre a filtrar"),
    db: Session = Depends(get_db)
):
    query = db.query(
        Student.matricula,
        (Student.nombre + " " + Student.apellido_paterno + " " + Student.apellido_materno).label('nombre_completo'),
        Career.name.label('carrera'),
        StudentStatus.name.label('estatus')
    ).join(
        Career, Student.career_id == Career.id
    ).join(
        StudentStatus, Student.status_id == StudentStatus.id
    )

    if busqueda:
        termino = f"%{busqueda}%"
        query = query.filter(
            or_(
                Student.matricula.ilike(termino),
                (Student.nombre + " " + Student.apellido_paterno + " " + Student.apellido_materno).ilike(termino)
            )
        )

    if carrera_id:
        query = query.filter(Student.career_id == carrera_id)

    if cuatrimestre:
        query = query.filter(Student.cuatrimestre_actual == cuatrimestre)

    total = query.count()
    alumnos = query.offset(skip).limit(limit).all()

    # Formateamos para que el JSON sea un diccionario como espera React
    return {
        "total": total,
        "data": [dict(row._mapping) for row in alumnos]
    }

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
            raise HTTPException(status_code=400, detail="Esta CURP ya se encuentra registrada en el sistema.")
        if alumno_existente.email_personal == student_in.email_personal:
            raise HTTPException(status_code=400, detail="Este correo personal ya está en uso por otro alumno.")

    try:
        # Guardar foto en la tabla files
        foto_content = foto_perfil.file.read()
        foto_file = FileModel(
            file_name=foto_perfil.filename,
            mime_type=foto_perfil.content_type or "image/jpeg",
            size_bytes=len(foto_content),
            file_content=foto_content
        )
        db.add(foto_file)
        db.flush()

        # Guardar certificado en la tabla files (si se proporcionó)
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

        activo_status = db.query(StudentStatus).filter(StudentStatus.name == 'activo').first()
        new_student = Student(
            matricula=final_matricula,
            nombre=student_in.nombre,
            apellido_paterno=student_in.apellido_paterno,
            apellido_materno=student_in.apellido_materno,
            curp=student_in.curp,
            email_personal=student_in.email_personal,
            email_institucional=student_in.email_institucional,
            career_id=student_in.career_id,
            origin_school_id=student_in.origin_school_id,
            promedio_procedencia=student_in.promedio_procedencia,
            cuatrimestre_actual=1,
            status_id=data_dict.get('status_id') or (activo_status.id if activo_status else 1),
            foto_id=foto_file.id,
            certificado_id=cert_file_id
        )
        db.add(new_student)
        db.flush()

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
            print(f"Registro exitoso, pero fallo correo: {email_err}")

        return {"status": "success", "matricula": final_matricula, "temporal_password": raw_pass}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en BD: {str(e)}")



# ENDPOINT: IMPORTACIÓN MASIVA MEJORADA

@router.post("/importar")
async def importar_alumnos(file: UploadFile = File(...), db: Session = Depends(get_db)):
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

    regex_solo_letras = r'^[A-Za-záéíóúÁÉÍÓÚñÑüÜ\s]+$'
    regex_curp = r'^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$'
    regex_cp = r'^\d{5}$'
    regex_email_pers = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
    regex_email_inst = r'^[a-zA-Z0-9_.+-]+@red\.unid\.mx$'

    matriculas_vistas = set()
    curps_vistos = set()
    correos_inst_vistos = set()
    correos_pers_vistos = set()
    nombres_completos_vistos = set()

    for index, row in df.iterrows():
        fila_excel = index + 2
        errores_fila = []
        campos_error = []


        matricula_str = str(row.get('Matrícula', '')).strip()
        if matricula_str.endswith('.0'): matricula_str = matricula_str[:-2]
        if not matricula_str or matricula_str == 'nan': continue

        if not re.match(r'^\d{8}$', matricula_str):
            errores_fila.append("La matrícula debe tener exactamente 8 dígitos numéricos")
            campos_error.append("Matrícula")
        elif matricula_str in matriculas_vistas:
            errores_fila.append("Matrícula duplicada en este mismo archivo Excel")
            campos_error.append("Matrícula")
        elif db.query(Student).filter(Student.matricula == matricula_str).first():
            errores_fila.append("La matrícula ya existe en la base de datos")
            campos_error.append("Matrícula")
        else:
            matriculas_vistas.add(matricula_str)


        nombre = str(row.get('Nombre', '')).strip()
        ap_paterno = str(row.get('Apellido Paterno', '')).strip()
        ap_materno = str(row.get('Apellido Materno', '')).strip()

        if not nombre or nombre == 'nan':
            errores_fila.append("El nombre no puede estar vacío")
            campos_error.append("Nombre")
        elif not re.match(regex_solo_letras, nombre):
            errores_fila.append("El nombre no debe contener números ni símbolos")
            campos_error.append("Nombre")

        if ap_paterno and ap_paterno != 'nan' and not re.match(regex_solo_letras, ap_paterno):
            errores_fila.append("El apellido paterno no debe contener números")
            campos_error.append("Apellido Paterno")

        if ap_materno and ap_materno != 'nan' and not re.match(regex_solo_letras, ap_materno):
            errores_fila.append("El apellido materno no debe contener números")
            campos_error.append("Apellido Materno")


        if nombre and nombre != 'nan':
            ap_pat_limpio = ap_paterno if ap_paterno != 'nan' else ""
            ap_mat_limpio = ap_materno if ap_materno != 'nan' else ""


            nombre_completo_norm = f"{nombre} {ap_pat_limpio} {ap_mat_limpio}".lower()
            nombre_completo_norm = " ".join(nombre_completo_norm.split())

            if nombre_completo_norm in nombres_completos_vistos:
                errores_fila.append("Este nombre completo (nombre y apellidos) está duplicado en el archivo Excel")
                campos_error.extend(["Nombre", "Apellido Paterno", "Apellido Materno"])
            else:

                existe_homonimo = db.query(Student).filter(
                    func.lower(func.trim(Student.nombre)) == nombre.lower(),
                    func.lower(func.trim(Student.apellido_paterno)) == ap_pat_limpio.lower(),
                    func.lower(func.trim(Student.apellido_materno)) == ap_mat_limpio.lower()
                ).first()

                if existe_homonimo:
                    errores_fila.append("Ya existe un alumno registrado exactamente con este mismo nombre y apellidos")
                    campos_error.extend(["Nombre", "Apellido Paterno", "Apellido Materno"])
                else:
                    nombres_completos_vistos.add(nombre_completo_norm)


        curp_str = str(row.get('Curp', '')).strip().upper()
        if not curp_str or curp_str == 'nan':
            errores_fila.append("El CURP es obligatorio")
            campos_error.append("Curp")
        elif len(curp_str) != 18 or not re.match(regex_curp, curp_str):
            errores_fila.append("Formato de CURP inválido (Deben ser 18 caracteres reales)")
            campos_error.append("Curp")
        elif curp_str in curps_vistos:
            errores_fila.append("CURP duplicado en este mismo archivo Excel")
            campos_error.append("Curp")
        elif db.query(Student).filter(Student.curp == curp_str).first():
            errores_fila.append(f"El CURP {curp_str} ya está registrado")
            campos_error.append("Curp")
        else:
            curps_vistos.add(curp_str)


        cp_str = str(row.get('Código Postal', '')).strip()
        if cp_str.endswith('.0'): cp_str = cp_str[:-2]
        if cp_str and cp_str != 'nan' and not re.match(regex_cp, cp_str):
            errores_fila.append("El Código Postal debe tener exactamente 5 números")
            campos_error.append("Código Postal")


        municipio_str = str(row.get('Municipio', '')).strip()
        if municipio_str and municipio_str != 'nan' and not re.match(regex_solo_letras, municipio_str):
            errores_fila.append("El municipio solo debe contener letras")
            campos_error.append("Municipio")


        email_pers = str(row.get('Correo Personal', '')).strip()
        if email_pers and email_pers != 'nan':
            if not re.match(regex_email_pers, email_pers):
                errores_fila.append("Formato de correo personal inválido")
                campos_error.append("Correo Personal")
            elif email_pers in correos_pers_vistos:
                errores_fila.append("Correo personal duplicado en este mismo Excel")
                campos_error.append("Correo Personal")
            elif db.query(Student).filter(Student.email_personal == email_pers).first():
                errores_fila.append("Este correo personal ya está en uso")
                campos_error.append("Correo Personal")
            else:
                correos_pers_vistos.add(email_pers)

        email_inst = str(row.get('Correo Institucional', '')).strip()
        if email_inst and email_inst != 'nan':
            if not re.match(regex_email_inst, email_inst):
                errores_fila.append("El correo institucional debe pertenecer al dominio @red.unid.mx")
                campos_error.append("Correo Institucional")
            elif email_inst in correos_inst_vistos:
                errores_fila.append("Correo institucional duplicado en este mismo Excel")
                campos_error.append("Correo Institucional")
            elif db.query(User).filter(User.email == email_inst).first() or \
                 db.query(Student).filter(Student.email_institucional == email_inst).first():
                errores_fila.append("Este correo institucional ya está registrado en el sistema")
                campos_error.append("Correo Institucional")
            else:
                correos_inst_vistos.add(email_inst)


        cuat_str = str(row.get('Cuatrimestre', '')).strip()
        if cuat_str.endswith('.0'): cuat_str = cuat_str[:-2]
        cuat_final = 1
        if cuat_str and cuat_str != 'nan':
            if not cuat_str.isdigit() or not (1 <= int(cuat_str) <= 10):
                errores_fila.append("El cuatrimestre debe ser un número del 1 al 10")
                campos_error.append("Cuatrimestre")
            else:
                cuat_final = int(cuat_str)


        promedio_str = str(row.get('Promedio General', '')).strip()

        # Quitamos el '.0' fantasma de pandas
        if promedio_str.endswith('.0'):
            promedio_str = promedio_str[:-2]

        promedio_final = 0
        if promedio_str and promedio_str != 'nan':
            # Validamos que sea un número Y además que esté en el rango de 0 a 10
            if not promedio_str.isdigit() or not (0 <= int(promedio_str) <= 10):
                errores_fila.append("El promedio debe ser un número entero del 0 al 10 (No se aceptan decimales ni números mayores)")
                campos_error.append("Promedio General")
            else:
                promedio_final = int(promedio_str)

        carrera_excel = str(row.get('Carrera', '')).strip()
        career = db.query(Career).filter(
            (Career.external_id == carrera_excel) | (Career.name == carrera_excel)
        ).first()
        if not career:
            errores_fila.append(f"Carrera '{carrera_excel}' no encontrada")
            campos_error.append("Carrera")

        escuela_excel = str(row.get('Procedencia', '')).strip()
        school = db.query(OriginSchool).filter(OriginSchool.name == escuela_excel).first()
        if not school:
            errores_fila.append(f"Procedencia '{escuela_excel}' no registrada")
            campos_error.append("Procedencia")

        if errores_fila:

            campos_error = list(set(campos_error))
            errores_validacion.append({
                "fila": fila_excel,
                "matricula": matricula_str,
                "nombre": nombre,
                "campos": campos_error,
                "mensajes": errores_fila
            })
            continue

        try:
            estatus_excel = str(row.get('Estatus', 'activo')).strip().lower() if pd.notna(row.get('Estatus', 'activo')) else 'activo'
            nuevo_alumno = Student(
                matricula=matricula_str,
                nombre=nombre,
                apellido_paterno=ap_pat_limpio,
                apellido_materno=ap_mat_limpio,
                curp=curp_str,
                email_personal=email_pers,
                email_institucional=email_inst if email_inst and email_inst != 'nan' else None,
                cuatrimestre_actual=cuat_final,
                status_id=status_map.get(estatus_excel, 1),
                career_id=career.id,
                origin_school_id=school.id,
                promedio_procedencia=promedio_final
            )
            db.add(nuevo_alumno)

            if email_inst and email_inst != 'nan':
                caracteres = string.ascii_letters + string.digits
                password_aleatoria = ''.join(secrets.choice(caracteres) for _ in range(10))

                nuevo_usuario = User(
                    identifier=matricula_str,
                    email=email_inst,
                    password_hash=pwd_context.hash(password_aleatoria),
                    role_id=alumno_role.id if alumno_role else 3,
                    is_temp_password=True
                )
                db.add(nuevo_usuario)

                credenciales_generadas.append({
                    "nombre": f"{nombre} {ap_pat_limpio}",
                    "usuario": matricula_str,
                    "password": password_aleatoria,
                    "correo": email_inst
                })

            nueva_direccion = StudentAddress(
                student_matricula=matricula_str,
                calle=str(row.get('Calle', '')).strip(),
                numero_domicilio=str(row.get('Número de domicilio') or 'S/N'),
                colonia=str(row.get('Colonia', '')).strip(),
                codigo_postal=cp_str,
                municipio=municipio_str,
                estado=str(row.get('Estado', 'Campeche')).strip()
            )
            db.add(nueva_direccion)

            db.flush()
            registros_nuevos += 1

        except Exception as e:
            db.rollback()
            errores_validacion.append({
                "fila": fila_excel,
                "matricula": matricula_str,
                "nombre": nombre,
                "campos": ["Base de Datos"],
                "mensajes": [f"Error interno al guardar: El registro choca con datos existentes ({str(e).split('for key')[0]})"]
            })

    # si hubo un problema de validacion en cualquier fila, esto lo retorna al frontend
    if errores_validacion:
        db.rollback()
        filas_con_error = [str(err['fila']) for err in errores_validacion]
        filas_str = ", ".join(filas_con_error)

        return JSONResponse(
            status_code=400,
            content={
                "detail": f"Las filas {filas_str} no pasaron el sistema de validación. Por favor descargue el reporte, revise y vuelva a intentar.",
                "errores_detalle": errores_validacion
            }
        )

    db.commit()

    return {
        "message": f"{registros_nuevos} alumnos y usuarios creados correctamente.",
        "data": credenciales_generadas
    }

# --- ENDPOINT DE DETALLES PARA LA EDICIÓN (HU-04) ---
@router.get("/detalle/{matricula}")
def get_student_detail(matricula: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.matricula == matricula).first()
    if not student:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")

    address = db.query(StudentAddress).filter(StudentAddress.student_matricula == matricula).first()

    return {
        "student": {
            "matricula": student.matricula,
            "nombre": student.nombre,
            "apellido_paterno": student.apellido_paterno,
            "apellido_materno": student.apellido_materno,
            "curp": student.curp,
            "email_personal": student.email_personal,
            "email_institucional": student.email_institucional,
            "career_id": student.career_id,
            "origin_school_id": student.origin_school_id,
            "promedio_procedencia": int(student.promedio_procedencia) if student.promedio_procedencia else '',
            "status_id": student.status_id,
            "status": student.status.name if student.status else None,
            "foto_id": student.foto_id,
            "foto_nombre": student.foto.file_name if student.foto else None,
            "certificado_id": student.certificado_id,
            "certificado_nombre": student.certificado.file_name if student.certificado else None
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

# --- ENDPOINT PARA ACTUALIZAR ALUMNO (HU-04) ---
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

    # 1. Buscamos al alumno y su dirección
    student = db.query(Student).filter(Student.matricula == matricula).first()
    if not student:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")

    address = db.query(StudentAddress).filter(StudentAddress.student_matricula == matricula).first()

    # 2. Validación de Unicidad: Que la CURP o el Correo no choquen con OTROS alumnos
    nueva_curp = data_dict.get('curp')
    nuevo_email = data_dict.get('email_personal')

    curp_existente = db.query(Student).filter(Student.curp == nueva_curp, Student.matricula != matricula).first()
    if curp_existente:
        raise HTTPException(status_code=400, detail="Esta CURP ya está registrada en otro alumno.")

    email_existente = db.query(Student).filter(Student.email_personal == nuevo_email, Student.matricula != matricula).first()
    if email_existente:
        raise HTTPException(status_code=400, detail="Este correo personal ya está en uso por otro alumno.")

    # 3. Actualizamos la información principal
    # (NOTA: Matrícula y Promedio no se tocan, protegiendo el historial académico)
    student.nombre = data_dict.get('nombre', student.nombre)
    student.apellido_paterno = data_dict.get('apellido_paterno', student.apellido_paterno)
    student.apellido_materno = data_dict.get('apellido_materno', student.apellido_materno)
    student.curp = nueva_curp
    student.email_personal = nuevo_email
    student.email_institucional = data_dict.get('email_institucional', student.email_institucional)
    student.career_id = data_dict.get('career_id', student.career_id)
    student.origin_school_id = data_dict.get('origin_school_id', student.origin_school_id)

    # 4. Actualizamos la dirección
    addr_data = data_dict.get('address', {})
    if address:
        address.calle = addr_data.get('calle', address.calle)
        address.numero_domicilio = addr_data.get('numero_domicilio', address.numero_domicilio)
        address.colonia = addr_data.get('colonia', address.colonia)
        address.codigo_postal = addr_data.get('codigo_postal', address.codigo_postal)
        address.municipio = addr_data.get('municipio', address.municipio)
        address.estado = addr_data.get('estado', address.estado)

    # 5. Si el administrador subió nuevos archivos, los guardamos en la BD
    if foto_perfil:
        foto_content = foto_perfil.file.read()
        foto_file = FileModel(
            file_name=foto_perfil.filename,
            mime_type=foto_perfil.content_type or "image/jpeg",
            size_bytes=len(foto_content),
            file_content=foto_content
        )
        db.add(foto_file)
        db.flush()
        student.foto_id = foto_file.id

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
        student.certificado_id = cert_file.id

    # Guardamos los cambios
    try:
        db.commit()
        return {"status": "success", "message": "Alumno actualizado correctamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar en base de datos: {str(e)}")


# --- ENDPOINT PARA SERVIR ARCHIVOS ---
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

# ==========================================
# PERIODOS ACADÉMICOS
# ==========================================
@router.get("/periodos")
def get_periodos(db: Session = Depends(get_db)):
    periodos = db.query(AcademicPeriod).order_by(AcademicPeriod.period_name.desc()).all()
    return [{"period_name": p.period_name, "is_active": p.is_active} for p in periodos]

# ==========================================
# HU-23: VISUALIZACIÓN DE CALIFICACIONES (ALUMNO)
# ==========================================
@router.get("/mis-calificaciones/{matricula}", response_model=list[MisCalificacionesResponse])
def get_my_grades(
    matricula: str,
    periodo: Optional[str] = None,
    db: Session = Depends(get_db),
):
    if not periodo:
        periodo_activo = db.query(AcademicPeriod).filter(AcademicPeriod.is_active == True).first()
        if not periodo_activo:
            periodo_activo = db.query(AcademicPeriod).order_by(AcademicPeriod.period_name.desc()).first()
        periodo = periodo_activo.period_name if periodo_activo else "2026-1"

    # 2. Hacemos el JOIN para cruzar el Kardex con Grupos y Materias
    resultados = (
        db.query(
            Subject.nombre.label("materia"),
            StudentEnrollment.parcial_1,
            StudentEnrollment.parcial_2,
            StudentEnrollment.parcial_3,
            StudentEnrollment.calificacion_final,
            StudentEnrollment.status
        )
        .join(AcademicGroup, StudentEnrollment.academic_group_id == AcademicGroup.id)
        .join(Subject, AcademicGroup.subject_id == Subject.id)
        .filter(
            StudentEnrollment.student_matricula == matricula,
            StudentEnrollment.period_name == periodo
        )
        .all()
    )
    return resultados