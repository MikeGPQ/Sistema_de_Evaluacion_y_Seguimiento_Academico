from sqlalchemy import Column, String, BigInteger, ForeignKey, CHAR, text
from sqlalchemy.orm import relationship
from app.db.database import Base

class StudentAddress(Base):

    __tablename__ = "student_addresses"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    
    student_matricula = Column(
        String(20), 
        ForeignKey("students.matricula", ondelete="CASCADE"), 
        unique=True, 
        nullable=False
    )
    
    calle = Column(String(150), nullable=False)
    numero_domicilio = Column(String(50), nullable=False)
    colonia = Column(String(100), nullable=False)
    codigo_postal = Column(CHAR(5), nullable=False)
    municipio = Column(String(100), nullable=False)
    estado = Column(String(50), nullable=False, server_default="Campeche")
    student = relationship("Student", back_populates="address")