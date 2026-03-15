from sqlalchemy import Column, String, Date, Boolean, DateTime, text
from app.db.database import Base


class AcademicPeriod(Base):
    __tablename__ = "academic_periods"

    period_name = Column(String(20), primary_key=True)
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=False)
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, nullable=True, server_default=text("CURRENT_TIMESTAMP"))
