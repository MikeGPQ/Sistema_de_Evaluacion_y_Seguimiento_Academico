from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base

class SigadGroup(Base):

    __tablename__ = "sigad_groups"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    external_id = Column(Integer, nullable=False)
    identificador = Column(String(15), nullable=False)
    nivel_academico = Column(String(50), nullable=True)
    
    career_id = Column(Integer, ForeignKey("academic_programs.id"), nullable=False) 
    quarter_id = Column(Integer, ForeignKey("quarter_catalog.id"), nullable=False)

    career = relationship("AcademicProgram", back_populates="sigad_groups")
    quarter = relationship("QuarterCatalog", back_populates="sigad_groups")
    
    academic_profiles = relationship("StudentAcademicProfile", back_populates="sigad_group")
    academic_groups = relationship("AcademicGroup", back_populates="sigad_group")