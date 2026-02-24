import json
import shutil
import os
import secrets
import string
import io
import pandas as pd
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
from app.core.security import get_password_hash

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
            status='activo',
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

            curp_str = str(row.get('Curp', '')).strip()
        if db.query(Student).filter(Student.curp == curp_str).first():
            errores_fila.append(f"El CURP {curp_str} ya está registrado")
            campos_error.append("Curp")

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