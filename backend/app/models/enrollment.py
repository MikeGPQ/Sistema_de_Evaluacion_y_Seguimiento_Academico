from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, TIMESTAMP, text
from app.db.database import Base

class StudentEnrollment(Base):
    __tablename__ = "student_enrollments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_matricula = Column(String(20), ForeignKey("students.matricula"), nullable=False)
    academic_group_id = Column(Integer, ForeignKey("academic_groups.id"), nullable=False)
    period_name = Column(String(20), nullable=False) 
    is_retake = Column(Boolean, default=False)
    enrolled_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))