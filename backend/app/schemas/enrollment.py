from pydantic import BaseModel, Field
from typing import List, Optional

# ==========================================
# MÓDULO DE CARGA ACADÉMICA (No tocar)
# ==========================================
class MateriaSeleccionada(BaseModel):
    subject_id: int
    group_id: int
    is_retake: Optional[bool] = False

class GuardarCargaRequest(BaseModel):
    materias: List[MateriaSeleccionada]

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
class MisCalificacionesResponse(BaseModel):
    materia: str # El nombre de la materia en texto plano
    carrera: str
    cuatrimestre: int
    parcial_1: Optional[int]
    parcial_2: Optional[int]
    parcial_3: Optional[int]
    calificacion_final: Optional[int]
    status: str

    class Config:
        from_attributes = True
 
