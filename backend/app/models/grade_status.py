from sqlalchemy import Column, String, Boolean
from sqlalchemy.orm import relationship
from app.db.database import Base

class GradeStatus(Base):

    __tablename__ = "grade_statuses"

    code = Column(String(2), primary_key=True)
    description = Column(String(100), nullable=False)
    is_manual_justification = Column(Boolean, nullable=False, default=True)

    enrollments_p1 = relationship("StudentEnrollment", foreign_keys="StudentEnrollment.status_parcial_1")
    enrollments_p2 = relationship("StudentEnrollment", foreign_keys="StudentEnrollment.status_parcial_2")
    enrollments_p3 = relationship("StudentEnrollment", foreign_keys="StudentEnrollment.status_parcial_3")