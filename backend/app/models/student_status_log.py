from sqlalchemy import Column, String, Integer, BigInteger, ForeignKey, TIMESTAMP, text
from sqlalchemy.orm import relationship
from app.db.database import Base

class StudentStatusLog(Base):

    __tablename__ = "student_status_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    academic_profile_id = Column(Integer, ForeignKey("student_academic_profiles.id"), nullable=False)
    changed_by_user = Column(String(150), nullable=False)
    previous_status_id = Column(Integer, ForeignKey("student_statuses.id"), nullable=False)
    new_status_id = Column(Integer, ForeignKey("student_statuses.id"), nullable=False)
    evidence_file_id = Column(BigInteger, ForeignKey("files.id"), nullable=True)
    changed_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP"))

    academic_profile = relationship("StudentAcademicProfile", back_populates="status_logs")
    previous_status = relationship("StudentStatus", foreign_keys=[previous_status_id], overlaps="status_logs_previous")
    new_status = relationship("StudentStatus", foreign_keys=[new_status_id], overlaps="status_logs_new")
    evidence_file = relationship("File", back_populates="status_evidences")