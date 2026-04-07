from sqlalchemy import Column, Integer, Time, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base

class AssignmentSchedule(Base):

    __tablename__ = "assignment_schedules"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    academic_group_id = Column(Integer, ForeignKey("academic_groups.id", ondelete="CASCADE"), nullable=False)
    dia_semana = Column(Integer, nullable=False)
    hora_inicio = Column(Time, nullable=False)
    hora_fin = Column(Time, nullable=False)

    academic_group = relationship("AcademicGroup", back_populates="schedules")