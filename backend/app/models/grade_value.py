from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.database import Base

class GradeValue(Base):

    __tablename__ = "grade_values"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    value = Column(String(5), nullable=False) 
    numeric_value = Column(Integer, nullable=False)

    enrollments_p1 = relationship("StudentEnrollment", foreign_keys="StudentEnrollment.parcial_1_id")
    enrollments_p2 = relationship("StudentEnrollment", foreign_keys="StudentEnrollment.parcial_2_id")
    enrollments_p3 = relationship("StudentEnrollment", foreign_keys="StudentEnrollment.parcial_3_id")