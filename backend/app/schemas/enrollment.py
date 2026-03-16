from pydantic import BaseModel, Field
from typing import List, Optional

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
class StudentGradeUpdate(BaseModel):
    student_matricula: str

    # strict=True fuerza a que sea un INT real. ge=0 y le=10 limitan el rango (HU-20)
    parcial_1: Optional[int] = Field(None, ge=0, le=10, strict=True)
    status_parcial_1: Optional[str] = Field(None)

    parcial_2: Optional[int] = Field(None, ge=0, le=10, strict=True)
    status_parcial_2: Optional[str] = Field(None)

    parcial_3: Optional[int] = Field(None, ge=0, le=10, strict=True)
    status_parcial_3: Optional[str] = Field(None)

class BulkGradeUpdateRequest(BaseModel):
    docente_id: int
    students: List[StudentGradeUpdate]