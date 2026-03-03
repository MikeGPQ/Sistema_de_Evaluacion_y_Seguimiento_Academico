from sqlalchemy import Column, String, Integer, ForeignKey, TIMESTAMP, text
from sqlalchemy.orm import relationship
from app.db.database import Base

class StudentStatusLog(Base):
    __tablename__ = "student_status_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_matricula = Column(String(20), ForeignKey("students.matricula"), nullable=False)
    changed_by_user = Column(String(150), nullable=False)
    previous_status_id = Column(Integer, ForeignKey("student_statuses.id"), nullable=False)
    new_status_id = Column(Integer, ForeignKey("student_statuses.id"), nullable=False)
    changed_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))

    previous_status = relationship("StudentStatus", foreign_keys=[previous_status_id])
    new_status = relationship("StudentStatus", foreign_keys=[new_status_id])