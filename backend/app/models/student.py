from sqlalchemy import Column, String, Integer, ForeignKey, Enum, Numeric, TIMESTAMP, text
from app.db.database import Base

class Student(Base):
    __tablename__ = "students"

    matricula = Column(String(20), primary_key=True)
    nombre = Column(String(100), nullable=False)
    apellido_paterno = Column(String(100), nullable=False)
    apellido_materno = Column(String(100), nullable=False)
    curp = Column(String(18), nullable=False, unique=True)
    foto_path = Column(String(255), nullable=True)
    email_personal = Column(String(150), nullable=False)
    email_institucional = Column(String(150), nullable=True)
    certificado_path = Column(String(255), nullable=True)
    origin_school_id = Column(Integer, ForeignKey("origin_schools.id"), nullable=True)
    career_id = Column(Integer, ForeignKey("careers.id"), nullable=False)
    promedio_procedencia = Column(Numeric(4, 2), nullable=False)
    cuatrimestre_actual = Column(Integer, nullable=False, server_default=text("1"))
    status = Column(Enum('activo', 'baja', 'baja_temporal', 'egresado'), server_default='activo')
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(TIMESTAMP, server_default=text("NULL ON UPDATE CURRENT_TIMESTAMP"), nullable=True)
