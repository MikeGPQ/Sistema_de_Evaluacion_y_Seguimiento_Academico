from sqlalchemy import Column, Integer, String, ForeignKey, Numeric, Enum, TIMESTAMP, func, Boolean
from sqlalchemy.orm import relationship
from app.db.database import Base

class Career(Base):
    __tablename__ = "careers"
    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(String(50), unique=True, nullable=False)
    name = Column(String(150), nullable=False)

class OriginSchool(Base):
    __tablename__ = "origin_schools"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), unique=True, nullable=False)
    is_active = Column(Boolean, default=True)

class Student(Base):
    __tablename__ = "students"
    matricula = Column(String(20), primary_key=True)
    nombre = Column(String(100), nullable=False)
    apellido_paterno = Column(String(100), nullable=False)
    apellido_materno = Column(String(100), nullable=False)
    curp = Column(String(18), unique=True, nullable=False)
    foto_path = Column(String(255), nullable=True)
    email_personal = Column(String(150), nullable=False)
    email_institucional = Column(String(150), nullable=True)
    origin_school_id = Column(Integer, ForeignKey("origin_schools.id"), nullable=True)
    promedio_procedencia = Column(Numeric(4, 2), nullable=False)
    certificado_path = Column(String(255), nullable=True)
    career_id = Column(Integer, ForeignKey("careers.id"), nullable=False)
    cuatrimestre_actual = Column(Integer, default=1)
    status = Column(Enum('activo', 'baja', 'baja_temporal', 'egresado'), default='activo')

class StudentAddress(Base):
    __tablename__ = "student_addresses"
    id = Column(Integer, primary_key=True, index=True)
    student_matricula = Column(String(20), ForeignKey("students.matricula"), unique=True, nullable=False)
    calle = Column(String(150), nullable=False)
    numero_domicilio = Column(String(50), nullable=False)
    colonia = Column(String(100), nullable=False)
    codigo_postal = Column(String(5), nullable=False)
    municipio = Column(String(100), nullable=False)
    estado = Column(String(50), default="Campeche")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    identifier = Column(String(50), unique=True, nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum('admin', 'docente', 'alumno'), nullable=False)
    is_temp_password = Column(Integer, default=1)