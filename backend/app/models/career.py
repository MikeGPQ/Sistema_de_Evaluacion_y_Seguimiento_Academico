from sqlalchemy import Column, Integer, String
from app.db.database import Base

class Career(Base):
    __tablename__ = "careers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True)
    external_id = Column(String(50)) # ID externo si lo usas