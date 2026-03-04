from sqlalchemy import Column, Integer, String, ForeignKey, JSON, Enum, DateTime, text
from sqlalchemy.orm import relationship
from app.db.database import Base
import enum

class ActaStatus(str, enum.Enum):
    abierta = "abierta"
    cerrada = "cerrada"

class AcademicGroup(Base):
    __tablename__ = "academic_groups"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    
    periodo = Column(String(50), nullable=False) 
    identificador_grupo = Column(String(20), nullable=False) 
    
    horario_json = Column(JSON, nullable=False)
    cupo_maximo = Column(Integer, nullable=False)
    
    acta_status = Column(Enum(ActaStatus), default=ActaStatus.abierta)
    created_at = Column(DateTime, nullable=True, server_default=text("CURRENT_TIMESTAMP"))

    subject = relationship("Subject", back_populates="academic_groups")
    teacher = relationship("Teacher", back_populates="academic_groups")