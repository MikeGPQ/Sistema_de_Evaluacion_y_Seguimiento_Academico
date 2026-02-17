from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List

class CareerSelect(BaseModel):
    id: int
    name: str #
    model_config = ConfigDict(from_attributes=True)

class SchoolSelect(BaseModel):
    id: int
    name: str #
    model_config = ConfigDict(from_attributes=True)

class OptionsResponse(BaseModel):
    careers: List[CareerSelect]
    schools: List[SchoolSelect]

class AddressCreate(BaseModel):
    calle: str
    numero_domicilio: str
    colonia: str
    codigo_postal: str
    municipio: str
    estado: str = "Campeche"

class StudentCreate(BaseModel):
    nombre: str
    apellido_paterno: str
    apellido_materno: str
    curp: str
    email_personal: EmailStr
    email_institucional: Optional[EmailStr] = None 
    career_id: int
    origin_school_id: int
    promedio_procedencia: float
    address: AddressCreate