from sqlalchemy import Column, BigInteger, String, TIMESTAMP, text
from sqlalchemy.dialects.mysql import MEDIUMBLOB
from app.db.database import Base


class File(Base):
    __tablename__ = "files"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    file_name = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=False)
    size_bytes = Column(BigInteger, nullable=False)
    file_content = Column(MEDIUMBLOB, nullable=False)
    uploaded_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
