import json
import shutil
import os
import secrets
import string
import bcrypt
import io
import re
import pandas as pd
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from passlib.context import CryptContext 

from app.db.database import get_db
from app.models.student import Student
from app.models.student_addresses import StudentAddress
from app.models.career import Career
from app.models.origin_school import OriginSchool
from app.models.user import User
from app.schemas.student import StudentCreate, OptionsResponse

pwd_context = CryptContext(
    schemes=["bcrypt"], 
    deprecated="auto", 
    bcrypt__ident="2b" 
)

router = APIRouter(prefix="/alumnos", tags=["Alumnos"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/options", response_model=OptionsResponse)
def get_form_options(db: Session = Depends(get_db)):
    careers = db.query(Career).all()
    schools = db.query(OriginSchool).filter(OriginSchool.is_active == True).all()
    return {"careers": careers, "schools": schools}


# ENDPOINT: CONFIGURAR MATRÍCULA BASE

@router.post("/set-base-id")
def set_base_id(nueva_matricula: str = Form(...), db: Session = Depends(get_db)):
    if not nueva_matricula.isdigit():
        raise HTTPException(status_code=400, detail="La matrícula base debe contener solo números.")
    
    existe = db.query(Student).filter(Student.matricula == nueva_matricula).first()
    if existe:
        raise HTTPException(status_code=400, detail="Esta matrícula ya existe en el sistema.")
        
    try:
        career = db.query(Career).first()
        school = db.query(OriginSchool).first()
        
        dummy_student = Student(
            matricula=nueva_matricula,
            nombre="REGISTRO",
            apellido_paterno="BASE",
            apellido_materno="SISTEMA",
            curp=f"BASE{nueva_matricula}",
            email_personal="base@sistema.com",
            promedio_procedencia=0.0,
            career_id=career.id if career else 1,
            origin_school_id=school.id if school else 1,
            cuatrimestre_actual=1,
            status='baja'
        )
        db.add(dummy_student)
        db.commit()
        return {"message": f"Matrícula base actualizada correctamente a: {nueva_matricula}"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al fijar ID: {str(e)}")


# ENDPOINT: REGISTRO MANUAL

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

    foto_ext = foto_perfil.filename.split('.')[-1]
    foto_path = os.path.join(UPLOAD_DIR, f"foto_{final_matricula}.{foto_ext}")
    with open(foto_path, "wb") as buffer:
        shutil.copyfileobj(foto_perfil.file, buffer)

    cert_path = None
    if certificado:
        cert_ext = certificado.filename.split('.')[-1]
        cert_path = os.path.join(UPLOAD_DIR, f"cert_{final_matricula}.{cert_ext}")
        with open(cert_path, "wb") as buffer:
            shutil.copyfileobj(certificado.file, buffer)
            
    alumno_existente = db.query(Student).filter(
        (Student.curp == student_in.curp) | 
        (Student.email_personal == student_in.email_personal)
    ).first()

    if alumno_existente:
        if os.path.exists(foto_path): os.remove(foto_path)
        if cert_path and os.path.exists(cert_path): os.remove(cert_path)
        
        if alumno_existente.curp == student_in.curp:
            raise HTTPException(status_code=400, detail="Esta CURP ya se encuentra registrada en el sistema.")
        if alumno_existente.email_personal == student_in.email_personal:
            raise HTTPException(status_code=400, detail="Este correo personal ya está en uso por otro alumno.")
    
    try:
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
            status=data_dict.get('status', 'activo'), 
            foto_path=foto_path,
            certificado_path=cert_path
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

        new_user = User(
            identifier=final_matricula,
            email=student_in.email_personal,
            password_hash=hashed_pw,
            role='alumno',
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
            <head>
                <meta charset="utf-8">
            </head>
            <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; margin: 0; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                    
                    <div style="background-color: #4f46e5; padding: 25px; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px; color: #ffffff;">Sistema Escolar SESA</h1>
                    </div>
                    
                    <div style="padding: 30px; color: #374151; line-height: 1.6;">
                        <h2 style="margin-top: 0; font-size: 20px; color: #111827;">¡Hola, {student_in.nombre}!</h2>
                        <p style="font-size: 16px;">Tu alta en el <strong>Sistema de Evaluación y Seguimiento Académico</strong> se ha procesado exitosamente.</p>
                        
                        <div style="background-color: #f8fafc; border-left: 5px solid #4f46e5; padding: 20px; margin: 30px 0; border-radius: 0 6px 6px 0;">
                            <h3 style="margin-top: 0; color: #4f46e5; font-size: 16px;">🔑 Tus credenciales de acceso:</h3>
                            <p style="margin: 8px 0; font-size: 16px;"><strong>Matrícula (Usuario):</strong> <span style="font-size: 18px; color: #111827;">{final_matricula}</span></p>
                            <p style="margin: 8px 0; font-size: 16px;"><strong>Contraseña Temporal:</strong> <span style="font-family: monospace; background-color: #e2e8f0; padding: 4px 8px; border-radius: 4px; font-size: 18px; color: #b91c1c; font-weight: bold;">{raw_pass}</span></p>
                        </div>
                        
                        <p style="font-size: 14px; color: #6b7280; background-color: #fef2f2; border: 1px solid #fecaca; padding: 10px; border-radius: 5px;">
                            <em>⚠️ <strong>Nota importante:</strong> Te recomendamos cambiar tu contraseña al iniciar sesión por primera vez por motivos de seguridad.</em>
                        </p>
                        
                        <br>
                        <p style="font-size: 16px; margin-bottom: 0;">Saludos cordiales,</p>
                        <p style="font-size: 16px; font-weight: bold; margin-top: 5px; color: #4f46e5;">Administración Escolar SESA</p>
                    </div>
                    
                    <div style="background-color: #f9fafb; padding: 15px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb;">
                        Este es un mensaje automático generado por el sistema. Por favor, no respondas a este correo.
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
            print(f"Correo HTML enviado a {student_in.email_personal}")
        except Exception as email_err:
            print(f"Registro exitoso, pero fallo correo: {email_err}")

        return {"status": "success", "matricula": final_matricula, "temporal_password": raw_pass}

    except Exception as e:
        db.rollback()
        if os.path.exists(foto_path): os.remove(foto_path)
        if cert_path and os.path.exists(cert_path): os.remove(cert_path)
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

        if not re.match(r'^\d+$', matricula_str):
            errores_fila.append("La matrícula debe contener solo números")
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
        promedio_final = 0.0
        if promedio_str and promedio_str != 'nan':
            try:
                promedio_final = float(promedio_str)
            except ValueError:
                errores_fila.append("El promedio debe ser un valor numérico (ej. 8.5)")
                campos_error.append("Promedio General")

        
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
            nuevo_alumno = Student(
                matricula=matricula_str,
                nombre=nombre,
                apellido_paterno=ap_pat_limpio, 
                apellido_materno=ap_mat_limpio,
                curp=curp_str,
                email_personal=email_pers,
                email_institucional=email_inst if email_inst and email_inst != 'nan' else None,
                cuatrimestre_actual=cuat_final,
                status=row.get('Estatus', 'activo').lower(), 
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
                    role='alumno',
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