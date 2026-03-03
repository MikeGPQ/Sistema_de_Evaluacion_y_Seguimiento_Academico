from sqlalchemy import Column, Integer, String
from app.db.database import Base

class StudentStatus(Base):
    __tablename__ = "student_statuses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, unique=True)
    description = Column(String(255), nullable=True)
