from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.database import Base

class TitulationStatus(Base):
    __tablename__ = "titulation_statuses"

    id = Column(Integer, primary_key=True, index=True)
    # La columna 'name' la quitamos porque MySQL no la tiene
    description = Column(String(255), nullable=True)

    # Mantenemos la relación intacta para no romper StudentAcademicProfile
    student_profiles = relationship("StudentAcademicProfile", back_populates="estatus_titulacion")