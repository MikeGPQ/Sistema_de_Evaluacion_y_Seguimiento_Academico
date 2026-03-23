from sqlalchemy import Column, Integer, String, Boolean, TIMESTAMP, text
from sqlalchemy.orm import relationship
from app.db.database import Base

class Teacher(Base):

    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    matricula_empleado = Column(String(50), nullable=False, unique=True)
    sigad_docente_id = Column(Integer, nullable=True)
    sigad_usuario_id = Column(Integer, nullable=True)
    nombre = Column(String(100), nullable=False)
    apellido_paterno = Column(String(100), nullable=False)
    apellido_materno = Column(String(100), nullable=False)
    email_personal = Column(String(150), nullable=False)
    email_institucional = Column(String(150), nullable=True)
    nivel_academico = Column(String(50), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    academic_groups = relationship("AcademicGroup", back_populates="teacher")