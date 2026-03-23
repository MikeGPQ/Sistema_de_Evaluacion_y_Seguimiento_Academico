from sqlalchemy import Column, Integer, String, ForeignKey, DECIMAL, Boolean, DateTime, text
from sqlalchemy.orm import relationship
from app.db.database import Base

class AcademicGroup(Base):
    __tablename__ = "academic_groups"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    external_id = Column(Integer, nullable=True)
    
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    sigad_group_id = Column(Integer, ForeignKey("sigad_groups.id"), nullable=True)
    aula_id = Column(Integer, ForeignKey("classrooms.id"), nullable=True)
    period_id = Column(Integer, ForeignKey("academic_periods.id"), nullable=False)
    estatus_acta = Column(String(20), nullable=False, default="ABIERTA")
    promedio_consolidado = Column(DECIMAL(5, 2), nullable=True)
    tiene_reporte_externo = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP"))

    subject = relationship("Subject", back_populates="academic_groups")
    teacher = relationship("Teacher", back_populates="academic_groups")
    sigad_group = relationship("SigadGroup", back_populates="academic_groups")
    classroom = relationship("Classroom", back_populates="academic_groups")
    period = relationship("AcademicPeriod", back_populates="academic_groups")
    schedules = relationship("AssignmentSchedule", back_populates="academic_group", cascade="all, delete-orphan")
    enrollments = relationship("StudentEnrollment", back_populates="academic_group")