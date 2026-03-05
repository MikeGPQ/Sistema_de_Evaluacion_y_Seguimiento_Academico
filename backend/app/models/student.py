from sqlalchemy import Column, String, Integer, BigInteger, ForeignKey, TIMESTAMP, text
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
    origin_school_id = Column(Integer, ForeignKey("origin_schools.id"), nullable=True)
    promedio_procedencia = Column(Integer, nullable=False)
    certificado_id = Column(BigInteger, ForeignKey("files.id"), nullable=True)
    career_id = Column(Integer, ForeignKey("careers.id"), nullable=False)
    cuatrimestre_actual = Column(Integer, nullable=False, server_default=text("1"))
    status_id = Column(Integer, ForeignKey("student_statuses.id"), nullable=False, server_default=text("1"))
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(TIMESTAMP, server_default=text("NULL ON UPDATE CURRENT_TIMESTAMP"), nullable=True)
    career = relationship("Career")
    status = relationship("StudentStatus")
    foto = relationship("File", foreign_keys=[foto_id])
    certificado = relationship("File", foreign_keys=[certificado_id])
