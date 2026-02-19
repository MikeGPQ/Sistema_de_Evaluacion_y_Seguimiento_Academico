from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base

class Student(Base):
    __tablename__ = "students"

    matricula = Column(String(20), primary_key=True, index=True)
    nombre = Column(String(100))
    apellido_paterno = Column(String(100))
    apellido_materno = Column(String(100))
    status = Column(String(50), default="activo")
    
    # Relación con Carrera
    career_id = Column(Integer, ForeignKey("careers.id"))
    career = relationship("Career")