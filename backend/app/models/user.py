from sqlalchemy import Column, String, BigInteger, Boolean, Integer, ForeignKey, TIMESTAMP, text
from sqlalchemy.orm import relationship
from app.db.database import Base

class User(Base):

    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    identifier = Column(String(50), nullable=False, unique=True)
    email = Column(String(150), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    is_temp_password = Column(Boolean, nullable=False, default=True)
    failed_login_attempts = Column(Integer, nullable=False, server_default=text("0"))
    last_failed_attempt_at = Column(TIMESTAMP, nullable=True)
    is_locked = Column(Boolean, nullable=False, server_default=text("0"))
    locked_at = Column(TIMESTAMP, nullable=True)
    last_login = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP"))

    role = relationship("Role", back_populates="users")
    password_reset_codes = relationship("PasswordResetCode", back_populates="user", cascade="all, delete-orphan")