from sqlalchemy import Column, String, Integer, Boolean, text
from app.db.database import Base

class OriginSchool(Base):
    __tablename__ = "origin_schools"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(150), nullable=False, unique=True)
    is_active = Column(Boolean, server_default=text("TRUE"))