from sqlalchemy import Column, String, BigInteger, Boolean, Integer, ForeignKey, TIMESTAMP, text
from sqlalchemy.orm import relationship
from app.db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    identifier = Column(String(50), nullable=False, unique=True)
    email = Column(String(150), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)

    # Estado de cuenta
    is_active = Column(Boolean, server_default=text("TRUE"))

    # Contraseña temporal
    is_temp_password = Column(Boolean, server_default=text("TRUE"))

    # Seguridad de login
    failed_login_attempts = Column(Integer, server_default=text("0"))
    is_locked = Column(Boolean, server_default=text("FALSE"))
    locked_at = Column(TIMESTAMP, nullable=True)

    # Fechas
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
    last_login = Column(TIMESTAMP, nullable=True)

    # Relación con roles
    role = relationship("Role")