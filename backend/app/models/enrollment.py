from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Enum, DateTime, TIMESTAMP, Text, text
from sqlalchemy.orm import relationship
from app.db.database import Base
import enum


class EnrollmentStatus(str, enum.Enum):
    cursando = "cursando"
    aprobada = "aprobada"
    reprobada = "reprobada"


class StudentEnrollment(Base):
    __tablename__ = "student_enrollments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_matricula = Column(String(20), ForeignKey("students.matricula"), nullable=False)
    academic_group_id = Column(Integer, ForeignKey("academic_groups.id"), nullable=False)
    period_name = Column(String(20), nullable=False)
    is_retake = Column(Boolean, default=False)
    enrolled_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
    observaciones = Column(Text, nullable=True)
    parcial_1 = Column(Integer, nullable=True)
    status_parcial_1 = Column(String(2), server_default="OE")
    parcial_2 = Column(Integer, nullable=True)
    status_parcial_2 = Column(String(2), server_default="OE")
    parcial_3 = Column(Integer, nullable=True)
    status_parcial_3 = Column(String(2), server_default="OE")
    calificacion_final = Column(Integer, nullable=True)
    status = Column(Enum(EnrollmentStatus), server_default=EnrollmentStatus.cursando.name)

    student = relationship("Student")
    group = relationship("AcademicGroup")