from sqlalchemy import Column, String, Integer, ForeignKey, TIMESTAMP, text
from app.db.database import Base

class StudentStatusLog(Base):
    __tablename__ = "student_status_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_matricula = Column(String(20), ForeignKey("students.matricula"), nullable=False)
    changed_by_user = Column(String(150), nullable=False)
    previous_status = Column(String(50), nullable=False)
    new_status = Column(String(50), nullable=False)
    changed_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))