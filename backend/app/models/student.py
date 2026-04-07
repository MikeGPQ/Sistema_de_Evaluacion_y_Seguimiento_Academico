from sqlalchemy import Column, String, BigInteger, ForeignKey, TIMESTAMP, text
from sqlalchemy.orm import relationship
from app.db.database import Base

class Student(Base):

    __tablename__ = "students"

    matricula = Column(String(20), primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    apellido_paterno = Column(String(100), nullable=False)
    apellido_materno = Column(String(100), nullable=False)
    curp = Column(String(18), nullable=False, unique=True)
    foto_id = Column(BigInteger, ForeignKey("files.id"), nullable=True)
    email_personal = Column(String(150), nullable=False)
    email_institucional = Column(String(150), nullable=True)
    created_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(TIMESTAMP, nullable=True, onupdate=text("CURRENT_TIMESTAMP"))
    foto_perfil = relationship("File", back_populates="student_photos")
    address = relationship("StudentAddress", back_populates="student", uselist=False, cascade="all, delete-orphan")
    
    academic_profiles = relationship("StudentAcademicProfile", back_populates="student", cascade="all, delete-orphan")
    enrollments = relationship("StudentEnrollment", back_populates="student")