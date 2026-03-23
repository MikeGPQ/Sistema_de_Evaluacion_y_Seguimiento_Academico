from sqlalchemy import Column, String, BigInteger, ForeignKey, TIMESTAMP, text
from sqlalchemy.orm import relationship
from app.db.database import Base

class Student(Base):
    __tablename__ = "students"

    matricula = Column(String(20), primary_key=True, index=True)

    # DATOS PERSONALES (Los únicos que se quedaron en esta tabla)
    nombre = Column(String(100), nullable=False)
    apellido_paterno = Column(String(100), nullable=False)
    apellido_materno = Column(String(100), nullable=False)
    curp = Column(String(18), nullable=False, unique=True)
    foto_id = Column(BigInteger, ForeignKey("files.id"), nullable=True)
    email_personal = Column(String(150), nullable=False)
    email_institucional = Column(String(150), nullable=True)
    
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(TIMESTAMP, server_default=text("NULL ON UPDATE CURRENT_TIMESTAMP"), nullable=True)
    
    # RELACIONES VÁLIDAS
    foto = relationship("File", foreign_keys=[foto_id])
    
    # ❌ COLUMNAS ELIMINADAS (Movidas a student_academic_profiles por el arquitecto):
    # origin_school_id
    # promedio_procedencia
    # certificado_id
    # career_id (Ahora es academic_program_id)
    # cuatrimestre_actual
    # status_id
    
    # ❌ RELACIONES ELIMINADAS DE ESTE MODELO:
    # career = relationship("Career")  <-- La tabla careers ya no existe
    # status = relationship("StudentStatus")
    # certificado = relationship("File", foreign_keys=[certificado_id])