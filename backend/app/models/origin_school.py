from sqlalchemy import Column, String, Integer, Boolean, Enum, text
from sqlalchemy.orm import relationship
from app.db.database import Base

class OriginSchool(Base):

    __tablename__ = "origin_schools"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(150), nullable=False)
    tipo = Column(Enum('preparatoria', 'universidad'), nullable=False)
    is_active = Column(Boolean, nullable=False, server_default=text("1"))

    student_profiles = relationship("StudentAcademicProfile", back_populates="origin_school")