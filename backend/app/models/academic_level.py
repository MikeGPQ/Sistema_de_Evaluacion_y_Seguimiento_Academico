from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.database import Base

class AcademicLevel(Base):

    __tablename__ = "academic_levels"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    description = Column(String(255), nullable=True)

    student_profiles = relationship("StudentAcademicProfile", back_populates="nivel")