from sqlalchemy import Column, Integer, ForeignKey, DECIMAL, TIMESTAMP, text
from sqlalchemy.orm import relationship
from app.db.database import Base

class StudentPeriodGpa(Base):

    __tablename__ = "student_period_gpa"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    academic_profile_id = Column(Integer, ForeignKey("student_academic_profiles.id"), nullable=False)
    period_id = Column(Integer, ForeignKey("academic_periods.id"), nullable=False)
    gpa = Column(DECIMAL(4, 2), nullable=False)
    total_subjects = Column(Integer, nullable=False)
    approved_subjects = Column(Integer, nullable=False)
    failed_subjects = Column(Integer, nullable=False)
    calculated_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP"))

    academic_profile = relationship("StudentAcademicProfile", back_populates="period_gpas")
    period = relationship("AcademicPeriod", back_populates="period_gpas")