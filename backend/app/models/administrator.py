from sqlalchemy import Column, String, TIMESTAMP, Boolean, text
from app.db.database import Base

class Administrator(Base):
    __tablename__ = "administrators"

    numero_empleado = Column(String(50), primary_key=True)
    nombre = Column(String(100), nullable=False)
    apellido_paterno = Column(String(100), nullable=False)
    apellido_materno = Column(String(100), nullable=False)
    email_institucional = Column(String(150), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False) 
    created_at = Column(TIMESTAMP, nullable=True, server_default=text("CURRENT_TIMESTAMP"))