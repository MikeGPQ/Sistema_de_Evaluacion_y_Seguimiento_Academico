from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base

class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(String(50), unique=True, index=True, nullable=False)
    nombre = Column(String(150), nullable=False)
    cuatrimestre = Column(Integer, nullable=False)
    creditos = Column(Integer, nullable=False, default=0)
    
    career_id = Column(Integer, ForeignKey("careers.id"), nullable=False)

    academic_groups = relationship("AcademicGroup", back_populates="subject")