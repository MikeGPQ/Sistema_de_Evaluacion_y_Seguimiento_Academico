from pydantic import BaseModel, EmailStr, ConfigDict, Field
from typing import Optional, List

class CareerSelect(BaseModel):
    id: int
    name: str
    nivel_academico: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class SchoolSelect(BaseModel):
    id: int
    name: str
    tipo: str
    model_config = ConfigDict(from_attributes=True)

class LevelSelect(BaseModel):
    id: int
    name: str
    model_config = ConfigDict(from_attributes=True)

class PeriodSelect(BaseModel):
    id: int
    codigo: str
    anio: Optional[int] = None
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

class OptionsResponse(BaseModel):
    careers: List[CareerSelect]
    schools: List[SchoolSelect]
    levels: List[LevelSelect]
    periods: List[PeriodSelect]

class AddressCreate(BaseModel):
    calle: str
    numero_domicilio: str
    colonia: str
    codigo_postal: str
    municipio: str
    estado: str = "Campeche"

class StudentCreate(BaseModel):
    matricula: str = Field(..., pattern=r"^\d{8}$")
    nombre: str
    apellido_paterno: str
    apellido_materno: Optional[str] = None
    curp: str = Field(..., min_length=18, max_length=18)
    email_personal: EmailStr
    
    nivel_id: int
    career_id: int
    origin_school_id: int
    promedio_procedencia: int
    period_id: int
    address: AddressCreate
    usuario_id: Optional[str] = "Sistema"