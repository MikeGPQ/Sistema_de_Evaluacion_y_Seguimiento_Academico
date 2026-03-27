from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.database import Base

class TitulationStatus(Base):

    __tablename__ = "titulation_statuses"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(String(150), nullable=False)

    student_profiles = relationship("StudentAcademicProfile", back_populates="estatus_titulacion")