from sqlalchemy import Column, BigInteger, Integer, Date, Enum, TIMESTAMP, text, ForeignKey, String
from sqlalchemy.orm import relationship
from app.db.database import Base

class AttendanceRecord(Base):

    __tablename__ = "attendance_records"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    enrollment_id = Column(Integer, ForeignKey("student_enrollments.id"), nullable=False)
    fecha_clase = Column(Date, nullable=False)
    
    estado = Column(
        Enum('asistencia', 'falta', 'justificado', 'retardo'), 
        nullable=False
    )
    
    notas_justificacion = Column(String(255), nullable=True)
    created_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(TIMESTAMP, nullable=True, onupdate=text("CURRENT_TIMESTAMP"))

    enrollment = relationship("StudentEnrollment", back_populates="attendance_records")