from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.database import Base

class Classroom(Base):

    __tablename__ = "classrooms"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    external_id = Column(Integer, nullable=False)
    nombre_codigo = Column(String(30), nullable=False)
    capacidad = Column(Integer, nullable=False)
    tipo = Column(String(20), nullable=False)
    academic_groups = relationship("AcademicGroup", back_populates="classroom")