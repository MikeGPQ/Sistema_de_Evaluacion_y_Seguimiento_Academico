from sqlalchemy import Column, BigInteger, Integer, Date, Enum, TIMESTAMP, text, ForeignKey, String
from sqlalchemy.orm import relationship
from app.db.database import Base
# 🌟 AGREGA 'Text' AQUÍ ARRIBA:
from sqlalchemy import Column, Integer, String, Date, ForeignKey, Text
class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    enrollment_id = Column(Integer, ForeignKey("student_enrollments.id", ondelete="CASCADE"), nullable=False)
    fecha_clase = Column(Date, nullable=False)
    estado = Column(Enum('asistencia', 'falta', 'justificado', 'retardo'), nullable=False)
    notas_justificacion = Column(String(255), nullable=True) # 🌟 ¡LA COLUMNA QUE FALTABA!
    
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(TIMESTAMP, nullable=True, server_default=text("NULL ON UPDATE CURRENT_TIMESTAMP"))

    # Relación con la tabla de inscripciones
    enrollment = relationship("StudentEnrollment")
   