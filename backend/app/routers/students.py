import json
import shutil
import os
import secrets
import string
import bcrypt
import io
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

@router.get("/check-curp")
def check_curp(curp: str, db: Session = Depends(get_db)):
    existe = db.query(Student).filter(Student.curp == curp).first() is not None
    return {"exists": existe}

@router.get("/check-email")
def check_email(email: str, db: Session = Depends(get_db)):
    existe = db.query(Student).filter(Student.email_personal == email).first() is not None
    return {"exists": existe}

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
        salt = bcrypt.gensalt()
        hashed_pw = bcrypt.hashpw(raw_pass.encode('utf-8'), salt).decode('utf-8')

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

    for _, row in df.iterrows():
        matricula_str = str(row.get('Matrícula', '')).strip()
        if not matricula_str or matricula_str == 'nan': continue

        errores_fila = []
        campos_error = []

        if db.query(Student).filter(Student.matricula == matricula_str).first():
            errores_fila.append("La matrícula ya existe")
            campos_error.append("Matrícula")

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
            errores_validacion.append({
                "matricula": matricula_str,
                "nombre": row.get('Nombre', 'Desconocido'),
                "campos": campos_error,
                "mensajes": errores_fila
            })
            continue

        try:
            email_inst = row.get('Correo Institucional') or row.get('Correo institucional')

            nuevo_alumno = Student(
                matricula=matricula_str,
                nombre=row.get('Nombre'),
                apellido_paterno=row.get('Apellido Paterno'), 
                apellido_materno=row.get('Apellido Materno'),
                curp=row.get('Curp'),
                email_personal=row.get('Correo Personal') or row.get('Correo personal'),
                email_institucional=email_inst,
                cuatrimestre_actual=int(row.get('Cuatrimestre') or 1),
                status=row.get('Estatus', 'activo').lower(), 
                career_id=career.id,
                origin_school_id=school.id,
                promedio_procedencia=float(row.get('Promedio General', 0))
            )
            db.add(nuevo_alumno)

            if email_inst:
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
                    "nombre": f"{row.get('Nombre')} {row.get('Apellido Paterno')}",
                    "usuario": matricula_str,
                    "password": password_aleatoria,
                    "correo": email_inst
                })

            nueva_direccion = StudentAddress(
                student_matricula=matricula_str,
                calle=row.get('Calle'),
                numero_domicilio=str(row.get('Número de domicilio') or 'S/N'), 
                colonia=row.get('Colonia'),
                codigo_postal=str(row.get('Código Postal') or row.get('Código postal')),
                municipio=row.get('Municipio'),
                estado=row.get('Estado', 'Campeche')
            )
            db.add(nueva_direccion)
            
            registros_nuevos += 1

        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

    if errores_validacion:
        db.rollback()
        return JSONResponse(
            status_code=400,
            content={
                "detail": f"Se encontraron errores en {len(errores_validacion)} alumnos.",
                "errores_detalle": errores_validacion
            }
        )

    db.commit()
    
    return {
        "message": f"{registros_nuevos} alumnos y usuarios creados correctamente.",
        "data": credenciales_generadas 
    }