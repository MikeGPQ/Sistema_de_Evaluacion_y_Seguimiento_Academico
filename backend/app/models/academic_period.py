from sqlalchemy import Column, String, Date, Boolean, TIMESTAMP, text
from app.db.database import Base

class AcademicPeriod(Base):
    __tablename__ = "academic_periods"

    period_name = Column(String(20), primary_key=True)
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=False)
    is_active = Column(Boolean, server_default=text("FALSE"))
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
