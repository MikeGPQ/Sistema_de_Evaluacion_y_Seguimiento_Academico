from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.database import Base

class QuarterCatalog(Base):

    __tablename__ = "quarter_catalog"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    external_id = Column(Integer, nullable=False)
    nombre = Column(String(50), nullable=False)
    subjects = relationship("Subject", back_populates="quarter")
    sigad_groups = relationship("SigadGroup", back_populates="quarter")
    student_profiles = relationship("StudentAcademicProfile", back_populates="quarter_actual")