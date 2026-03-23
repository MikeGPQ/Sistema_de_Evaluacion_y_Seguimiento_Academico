import json
import io
import re
import secrets
import string
import pandas as pd
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.db.database import get_db
from app.models.file import File as FileModel
from app.models.student import Student
from app.models.student_academic_profile import StudentAcademicProfile
from app.models.student_addresses import StudentAddress
from app.models.student_status import StudentStatus
from app.models.academic_program import AcademicProgram
from app.models.academic_level import AcademicLevel
from app.models.origin_school import OriginSchool
from app.models.user import User
from app.models.role import Role
from app.models.academic_period import AcademicPeriod
from app.models.enrollment import StudentEnrollment
from app.models.quarter_catalog import QuarterCatalog
from app.schemas.student import StudentCreate
from app.core.security import get_password_hash
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/alumnos", tags=["Alumnos"])

# --- AUXILIARES ---
def generar_password():
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(10))

# --- ENDPOINTS ---

@router.get("/config-inicial")
def get_config_registro(db: Session = Depends(get_db)):
    return {
        "niveles": db.query(AcademicLevel).all(),
        "programas": db.query(AcademicProgram).all(),
        "escuelas": db.query(OriginSchool).filter(OriginSchool.is_active == True).all(),
        "cuatrimestres": db.query(QuarterCatalog).all()
    }

@router.post("/registrar-completo", status_code=status.HTTP_201_CREATED)
async def registrar_alumno_v3(
    student_data: str = Form(...),
    foto_perfil: UploadFile = File(...),
    certificado: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    try:
        data = json.loads(student_data)
        # Validar si existe la identidad (Student)
        alumno = db.query(Student).filter(Student.curp == data['curp']).first()
        
        # 1. Crear Identidad si no existe
        if not alumno:
            # Procesar Foto
            foto_cont = await foto_perfil.read()
            foto_db = FileModel(filename=foto_perfil.filename, mime_type=foto_perfil.content_type, file_content=foto_cont)
            db.add(foto_db)
            db.flush()

            alumno = Student(
                matricula=data['matricula'], # O generar auto
                nombre=data['nombre'],
                apellido_paterno=data['apellido_paterno'],
                apellido_materno=data['apellido_materno'],
                curp=data['curp'],
                email_personal=data['email_personal'],
                foto_id=foto_db.id
            )
            db.add(alumno)
            
            # Dirección
            direccion = StudentAddress(
                student_matricula=alumno.matricula,
                calle=data['calle'], colonia=data['colonia'], cp=data['cp'], municipio=data['municipio']
            )
            db.add(direccion)

        # 2. Crear Perfil Académico (La trayectoria específica V3.0)
        cert_id = None
        if certificado:
            cert_cont = await certificado.read()
            cert_db = FileModel(filename=certificado.filename, mime_type=certificado.content_type, file_content=cert_cont)
            db.add(cert_db)
            db.flush()
            cert_id = cert_db.id

        nuevo_perfil = StudentAcademicProfile(
            student_matricula=alumno.matricula,
            nivel_id=data['nivel_id'],
            career_id=data['career_id'],
            origin_school_id=data['origin_school_id'],
            promedio_procedencia=data['promedio_procedencia'],
            status_id=1, # Activo por defecto
            quarter_actual_id=1, # Inicia en 1ero
            period_id=data['period_id'],
            certificado_id=cert_id
        )
        db.add(nuevo_perfil)

        # 3. Crear Usuario de Acceso
        raw_pass = generar_password()
        rol_alumno = db.query(Role).filter(Role.name == 'alumno').first()
        nuevo_usuario = User(
            identifier=alumno.matricula,
            email=alumno.email_personal,
            password_hash=get_password_hash(raw_pass),
            role_id=rol_alumno.id,
            is_temp_password=True
        )
        db.add(nuevo_usuario)
        
        db.commit()
        return {"status": "success", "matricula": alumno.matricula, "temp_pass": raw_pass}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/listado-perfiles")
def listar_perfiles_academicos(
    nivel_id: Optional[int] = None,
    busqueda: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(StudentAcademicProfile).join(Student)
    
    if nivel_id:
        query = query.filter(StudentAcademicProfile.nivel_id == nivel_id)
    if busqueda:
        query = query.filter(or_(
            Student.matricula.ilike(f"%{busqueda}%"),
            Student.nombre.ilike(f"%{busqueda}%")
        ))
        
    perfiles = query.all()
    return [{
        "id": p.id,
        "matricula": p.student_matricula,
        "nombre": f"{p.student.nombre} {p.student.apellido_paterno}",
        "programa": p.career.name,
        "nivel": p.nivel.name,
        "estatus": p.status.name
    } for p in perfiles]

@router.get("/kardex/{profile_id}")
def obtener_kardex_perfil(profile_id: int, db: Session = Depends(get_db)):
    perfil = db.query(StudentAcademicProfile).filter(StudentAcademicProfile.id == profile_id).first()
    if not perfil: raise HTTPException(status_code=404)

    inscripciones = db.query(StudentEnrollment).filter(
        StudentEnrollment.academic_profile_id == profile_id
    ).all()

    return {
        "alumno": f"{perfil.student.nombre} {perfil.student.apellido_paterno}",
        "programa": perfil.career.name,
        "historial": [{
            "materia": i.academic_group.subject.nombre,
            "periodo": i.academic_group.period.period_name,
            "calificacion": i.calificacion_final,
            "estatus": i.status
        } for i in inscripciones]
    }