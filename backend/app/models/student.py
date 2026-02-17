from sqlalchemy import Column, String, Integer, DECIMAL, ForeignKey, Enum
from app.db.database import Base

class Student(Base):
    __tablename__ = "students"

    matricula = Column(String(20), primary_key=True) 
    nombre = Column(String(100), nullable=False)
    apellido_paterno = Column(String(100), nullable=False) 
    apellido_materno = Column(String(100), nullable=False)
    curp = Column(String(18), nullable=False, unique=True)
    email_personal = Column(String(150), nullable=False)
    email_institucional = Column(String(150), nullable=True)
    cuatrimestre_actual = Column(Integer, default=1) 
    career_id = Column(Integer, ForeignKey("careers.id"), nullable=False)
    origin_school_id = Column(Integer, ForeignKey("origin_schools.id"), nullable=True)
    promedio_procedencia = Column(DECIMAL(4, 2), nullable=False)
    status = Column(Enum('activo', 'baja', 'baja_temporal', 'egresado'), default='activo')