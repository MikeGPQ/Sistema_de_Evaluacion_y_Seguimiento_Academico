from sqlalchemy import Column, Integer, String, ForeignKey, text
from sqlalchemy.orm import relationship
from app.db.database import Base

class Subject(Base):

    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(Integer, nullable=True)
    codigo_unico = Column(String(20), nullable=True)
    nombre = Column(String(150), nullable=False)
    
    period_id = Column(Integer, ForeignKey("academic_periods.id"), nullable=True)
    quarter_id = Column(Integer, ForeignKey("quarter_catalog.id"), nullable=True)
    
    tipo_asignatura = Column(String(20), nullable=True)
    nivel_academico = Column(String(50), nullable=True)
    creditos = Column(Integer, nullable=False, server_default=text("0"))
    cupo_maximo = Column(Integer, nullable=True)
    career_id = Column(Integer, ForeignKey("academic_programs.id"), nullable=True)

    career = relationship("AcademicProgram", back_populates="subjects")
    period = relationship("AcademicPeriod", back_populates="subjects")
    quarter = relationship("QuarterCatalog", back_populates="subjects")
    academic_groups = relationship("AcademicGroup", back_populates="subject")