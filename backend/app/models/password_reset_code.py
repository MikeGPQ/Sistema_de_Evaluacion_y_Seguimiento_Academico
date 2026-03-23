from sqlalchemy import Column, BigInteger, String, TIMESTAMP, Boolean, ForeignKey, text
from sqlalchemy.orm import relationship
from app.db.database import Base

class PasswordResetCode(Base):

    __tablename__ = "password_reset_codes"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reset_code = Column(String(10), nullable=False)
    expires_at = Column(TIMESTAMP, nullable=False)
    is_used = Column(Boolean, nullable=False, default=False)
    created_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    user = relationship("User", back_populates="password_reset_codes")