from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Enum, TIMESTAMP, Text, text
from sqlalchemy.orm import relationship
from app.db.database import Base

class StudentEnrollment(Base):

    __tablename__ = "student_enrollments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_matricula = Column(String(20), ForeignKey("students.matricula"), nullable=False)
    academic_profile_id = Column(Integer, ForeignKey("student_academic_profiles.id"), nullable=False)
    academic_group_id = Column(Integer, ForeignKey("academic_groups.id"), nullable=False)
    period_id = Column(Integer, ForeignKey("academic_periods.id"), nullable=False)
    is_retake = Column(Boolean, nullable=False, default=False)
    es_adelanto = Column(Boolean, nullable=False, default=False)
    enrolled_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    
    parcial_1_id = Column(Integer, ForeignKey("grade_values.id"), nullable=True)
    status_parcial_1 = Column(String(2), ForeignKey("grade_statuses.code"), nullable=False, server_default="OE")
    
    parcial_2_id = Column(Integer, ForeignKey("grade_values.id"), nullable=True)
    status_parcial_2 = Column(String(2), ForeignKey("grade_statuses.code"), nullable=False, server_default="OE")
    
    parcial_3_id = Column(Integer, ForeignKey("grade_values.id"), nullable=True)
    status_parcial_3 = Column(String(2), ForeignKey("grade_statuses.code"), nullable=False, server_default="OE")
    
    calificacion_final = Column(Integer, nullable=True)
    
    status = Column(
        Enum('cursando', 'aprobada', 'reprobada'), 
        nullable=False, 
        server_default='cursando'
    )
    
    observaciones = Column(Text, nullable=True)

    student = relationship("Student", back_populates="enrollments")
    academic_profile = relationship("StudentAcademicProfile", back_populates="enrollments")
    academic_group = relationship("AcademicGroup", back_populates="enrollments")
    period = relationship("AcademicPeriod", back_populates="enrollments")
    
    calificacion_p1 = relationship("GradeValue", foreign_keys=[parcial_1_id], overlaps="enrollments_p1")
    calificacion_p2 = relationship("GradeValue", foreign_keys=[parcial_2_id], overlaps="enrollments_p2")
    calificacion_p3 = relationship("GradeValue", foreign_keys=[parcial_3_id], overlaps="enrollments_p3")
    
    attendance_records = relationship("AttendanceRecord", back_populates="enrollment", cascade="all, delete-orphan")