from pydantic import BaseModel
from typing import List

class MateriaSeleccionada(BaseModel):
    subject_id: int
    group_id: int
    is_retake: bool = False

class GuardarCargaRequest(BaseModel):
    materias: List[MateriaSeleccionada]