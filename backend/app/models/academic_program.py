from sqlalchemy import Column, Integer, String, TIMESTAMP, text
from sqlalchemy.orm import relationship
from app.db.database import Base

class AcademicProgram(Base):

    __tablename__ = "academic_programs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    external_id = Column(Integer, nullable=True)
    codigo_unico = Column(String(20), nullable=True)
    name = Column(String(150), nullable=False)
    modalidad = Column(String(50), nullable=True)
    nivel_academico = Column(String(50), nullable=True)
    created_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP"))

    subjects = relationship("Subject", back_populates="career")
    sigad_groups = relationship("SigadGroup", back_populates="career")
    student_profiles = relationship("StudentAcademicProfile", back_populates="career")