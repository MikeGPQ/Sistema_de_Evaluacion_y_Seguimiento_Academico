from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum

# ==========================================
# MÓDULO DE CARGA ACADÉMICA (No tocar)
# ==========================================
class GuardarCargaRequest(BaseModel):
    student_matricula: str
    academic_group_id: int
    period_name: str
    is_retake: Optional[bool] = False

# ==========================================
# MÓDULO DE CALIFICACIONES (Nuevos Esquemas)
# ==========================================
class JustificationCode(str, Enum):
    OE = "OE" # Original
    CO = "CO" # Corrección Por Omisión
    CP = "CP" # Corrección Por el profesor
    CR = "CR" # Corrección por error de captura
    DL = "DL" # Calificación Extemporánea
    EC = "EC" # Corrección por error en catálogo
    EI = "EI" # Equivalencia Interna
    EQ = "EQ" # Equivalencia
    RC = "RC" # Re-calculado
    RV = "RV" # Revalidación
    SE = "SE" # Corrección por error de seriado
    SG = "SG" # Sustitución de calificación

class StudentGradeUpdate(BaseModel):
    student_matricula: str
    
    # strict=True fuerza a que sea un INT real. ge=0 y le=10 limitan el rango (HU-20)
    parcial_1: Optional[int] = Field(None, ge=0, le=10, strict=True)
    status_parcial_1: Optional[JustificationCode] = Field(None)
    
    parcial_2: Optional[int] = Field(None, ge=0, le=10, strict=True)
    status_parcial_2: Optional[JustificationCode] = Field(None)
    
    parcial_3: Optional[int] = Field(None, ge=0, le=10, strict=True)
    status_parcial_3: Optional[JustificationCode] = Field(None)

class BulkGradeUpdateRequest(BaseModel):
    docente_id: int 
    students: List[StudentGradeUpdate]