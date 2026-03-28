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

#  Nuevo esquema para Estatus de Titulación
class TitulationStatusSelect(BaseModel):
    id: int
    description: str
    model_config = ConfigDict(from_attributes=True)

class OptionsResponse(BaseModel):
    careers: List[CareerSelect]
    schools: List[SchoolSelect]
    levels: List[LevelSelect]
    periods: List[PeriodSelect]
    titulation_statuses: List[TitulationStatusSelect] = [] 

class AddressCreate(BaseModel):
    calle: str
    numero_domicilio: str
    colonia: str
    codigo_postal: str
    municipio: str
    estado: str = "Campeche"

class StudentCreate(BaseModel):
    matricula: Optional[str] = None
    nombre: str
    apellido_paterno: str
    apellido_materno: Optional[str] = None
    curp: str = Field(..., min_length=18, max_length=18)
    email_personal: EmailStr
    email_institucional: Optional[str] = None

    nivel_id: int = 1 #   Por defecto es 1 (Licenciatura)
    titulation_status_id: Optional[int] = None #   Exclusivo de maestría
    career_id: int
    origin_school_id: int
    promedio_procedencia: int
    period_id: Optional[int] = None
    address: AddressCreate
    usuario_id: Optional[str] = "Sistema"