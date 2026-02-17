import json
import shutil
import os
import secrets
import string
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.database import get_db
from app.models.student import Student, StudentAddress, Career, OriginSchool, User
from app.schemas.student import StudentCreate, OptionsResponse

router = APIRouter(prefix="/students", tags=["students"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/options", response_model=OptionsResponse)
def get_form_options(db: Session = Depends(get_db)):
    """Carga carreras y escuelas"""
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

    # Matrícula automática correlativa
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
        # Forzado a 1º Cuatrimestre para Nuevo Ingreso
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

        # Hash seguro con bcrypt
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
        return {"status": "success", "matricula": final_matricula, "temporal_password": raw_pass}

    except Exception as e:
        db.rollback()
        if os.path.exists(foto_path): os.remove(foto_path)
        raise HTTPException(status_code=500, detail=f"Error en BD: {str(e)}")