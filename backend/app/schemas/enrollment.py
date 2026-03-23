from pydantic import BaseModel, Field
from typing import List, Optional

class MateriaSeleccionada(BaseModel):
    subject_id: int
    group_id: int
    is_retake: Optional[bool] = False

class GuardarCargaRequest(BaseModel):
    profile_id: Optional[int] = None
    materias: List[MateriaSeleccionada]
    usuario_id: Optional[str] = "Sistema"

class StudentGradeUpdate(BaseModel):
    student_matricula: str

    parcial_1: Optional[int] = None
    status_parcial_1: Optional[str] = None
    parcial_2: Optional[int] = None
    status_parcial_2: Optional[str] = None
    parcial_3: Optional[int] = None
    status_parcial_3: Optional[str] = None

class BulkGradeUpdateRequest(BaseModel):
    docente_id: int
    students: List[StudentGradeUpdate]

class MisCalificacionesResponse(BaseModel):
    materia: str 
    carrera: str
    cuatrimestre: str
    
    parcial_1: Optional[str] = None
    parcial_2: Optional[str] = None
    parcial_3: Optional[str] = None
    
    calificacion_final: Optional[int] = None
    status: str

    class Config:
        from_attributes = True