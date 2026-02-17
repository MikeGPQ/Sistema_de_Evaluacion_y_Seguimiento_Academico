from sqlalchemy import Column, String, Integer, DateTime
from app.db.database import Base
import datetime

class Career(Base):
    __tablename__ = "careers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    external_id = Column(String(10), nullable=False, unique=True) 
    name = Column(String(150), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)