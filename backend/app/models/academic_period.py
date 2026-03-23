from sqlalchemy import Column, Integer, String, Date, YEAR, Boolean, TIMESTAMP, text
from sqlalchemy.orm import relationship
from app.db.database import Base

class AcademicPeriod(Base):
    __tablename__ = "academic_periods"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    external_id = Column(Integer, nullable=True)
    codigo = Column(String(20), nullable=False)
    anio = Column(YEAR, nullable=True)
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=False)
    fecha_limite_calif = Column(Date, nullable=True)
    is_active = Column(Boolean, nullable=False, server_default=text("0"))
    created_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP"))

    subjects = relationship("Subject", back_populates="period")
    academic_groups = relationship("AcademicGroup", back_populates="period")
    enrollments = relationship("StudentEnrollment", back_populates="period")
    student_academic_profiles = relationship("StudentAcademicProfile", back_populates="period_ingreso")
    period_gpas = relationship("StudentPeriodGpa", back_populates="period")