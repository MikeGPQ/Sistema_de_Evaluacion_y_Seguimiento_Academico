from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.database import Base

class StudentStatus(Base):

    __tablename__ = "student_statuses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False, unique=True)
    description = Column(String(255), nullable=True)

    academic_profiles = relationship("StudentAcademicProfile", back_populates="status")
    status_logs_previous = relationship("StudentStatusLog", foreign_keys="StudentStatusLog.previous_status_id")
    status_logs_new = relationship("StudentStatusLog", foreign_keys="StudentStatusLog.new_status_id")