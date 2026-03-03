from sqlalchemy import Column, Integer, String, TIMESTAMP, text
from sqlalchemy.orm import relationship
from app.db.database import Base 

class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(String(50), unique=True, index=True, nullable=False)
    nombre = Column(String(100), nullable=False)
    apellido_paterno = Column(String(100), nullable=False)
    apellido_materno = Column(String(100), nullable=False)
    created_at = Column(TIMESTAMP, nullable=True, server_default=text("CURRENT_TIMESTAMP"))

    academic_groups = relationship("AcademicGroup", back_populates="teacher")