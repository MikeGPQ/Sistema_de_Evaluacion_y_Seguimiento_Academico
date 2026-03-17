from sqlalchemy import Column, String, Boolean
from app.db.database import Base


class GradeStatus(Base):
    __tablename__ = "grade_statuses"

    code = Column(String(10), primary_key=True)
    description = Column(String(255), nullable=False)
    is_manual_justification = Column(Boolean, default=True)
