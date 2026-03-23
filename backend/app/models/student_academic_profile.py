from sqlalchemy import Column, Integer, String, ForeignKey, TIMESTAMP, text, BigInteger
from sqlalchemy.orm import relationship
from app.db.database import Base

class StudentAcademicProfile(Base):

    __tablename__ = "student_academic_profiles"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_matricula = Column(String(20), ForeignKey("students.matricula"), nullable=False)
    nivel_id = Column(Integer, ForeignKey("academic_levels.id"), nullable=False)
    career_id = Column(Integer, ForeignKey("academic_programs.id"), nullable=False)
    origin_school_id = Column(Integer, ForeignKey("origin_schools.id"), nullable=True)
    promedio_procedencia = Column(Integer, nullable=False)
    certificado_id = Column(BigInteger, ForeignKey("files.id"), nullable=True)
    folio_certificado = Column(String(100), nullable=True)
    
    status_id = Column(Integer, ForeignKey("student_statuses.id"), nullable=False)
    sigad_group_id = Column(Integer, ForeignKey("sigad_groups.id"), nullable=True)
    quarter_actual_id = Column(Integer, ForeignKey("quarter_catalog.id"), nullable=False)
    
    estatus_titulacion_id = Column(Integer, ForeignKey("titulation_statuses.id"), nullable=True)
    
    period_id = Column(Integer, ForeignKey("academic_periods.id"), nullable=False)
    created_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP"))

    student = relationship("Student", back_populates="academic_profiles")
    nivel = relationship("AcademicLevel")
    career = relationship("AcademicProgram", back_populates="student_profiles")
    origin_school = relationship("OriginSchool", back_populates="student_profiles")
    status = relationship("StudentStatus", back_populates="academic_profiles")
    period_ingreso = relationship("AcademicPeriod", back_populates="student_academic_profiles")
    quarter_actual = relationship("QuarterCatalog")
    sigad_group = relationship("SigadGroup")
    certificado_file = relationship("File", back_populates="academic_certificates")
    
    estatus_titulacion = relationship("TitulationStatus", back_populates="student_profiles")
    enrollments = relationship("StudentEnrollment", back_populates="academic_profile")
    status_logs = relationship("StudentStatusLog", back_populates="academic_profile")
    period_gpas = relationship("StudentPeriodGpa", back_populates="academic_profile")