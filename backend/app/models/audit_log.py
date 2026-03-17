from sqlalchemy import BigInteger, Column, String, JSON, DateTime, text
from app.db.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_identifier = Column(String(50), nullable=True)  # Matrícula/external_id de quien hizo el cambio
    action = Column(String(50), nullable=False)           # 'CREATE', 'UPDATE', 'DELETE', 'LOGIN'
    entity_name = Column(String(50), nullable=False)      # Tabla afectada. Ej: 'student_enrollments'
    entity_id = Column(String(50), nullable=False)        # ID del registro afectado
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))