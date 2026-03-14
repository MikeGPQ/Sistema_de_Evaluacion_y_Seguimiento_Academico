from sqlalchemy import Column, Integer, String, Date, ForeignKey, Enum, text, TIMESTAMP
from sqlalchemy.orm import relationship
import enum
from app.db.database import Base

class TipoAsistencia(str, enum.Enum):
    presente = "presente"
    ausente = "ausente"
    retardo = "retardo"
    justificado = "justificado"

class Attendance(Base):
    __tablename__ = "attendances"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_matricula = Column(String(20), ForeignKey("students.matricula", ondelete="CASCADE"), nullable=False)
    academic_group_id = Column(Integer, ForeignKey("academic_groups.id", ondelete="CASCADE"), nullable=False)
    
    # La fecha exacta del pase de lista
    fecha = Column(Date, nullable=False)
    
    # El estado (presente, ausente, etc)
    estatus = Column(Enum(TipoAsistencia), nullable=False)
    
    # Observaciones opcionales (ej. "Trajo justificante médico")
    observaciones = Column(String(255), nullable=True)
    
    updated_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"))

    # Relaciones para poder acceder a los datos del alumno y del grupo fácilmente
    student = relationship("Student")
    academic_group = relationship("AcademicGroup")