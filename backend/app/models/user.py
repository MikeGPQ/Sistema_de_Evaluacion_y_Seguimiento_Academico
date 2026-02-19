from sqlalchemy import Column, String, BigInteger, Boolean, Enum, TIMESTAMP, text
from app.db.database import Base

class User(Base):
    tablename = "users"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    identifier = Column(String(50), nullable=False, unique=True) 
    email = Column(String(150), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum('admin', 'docente', 'alumno'), nullable=False)
    is_temp_password = Column(Boolean, server_default=text('TRUE'))
    created_at = Column(TIMESTAMP, server_default=text('CURRENT_TIMESTAMP'))
    last_login = Column(TIMESTAMP, nullable=True)