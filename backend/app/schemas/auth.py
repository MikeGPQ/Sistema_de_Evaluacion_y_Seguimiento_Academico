import re
from typing import Optional
from pydantic import BaseModel, Field, field_validator

PASSWORD_DESC = "Debe tener al menos 8 caracteres, una mayúscula, minúscula, un número y un carácter especial"

def validate_secure_password(v: str) -> str:
    # Usamos la librería 're' de Python que sí soporta look-aheads
    pattern = r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])[A-Za-z\d\W_]{8,}$"
    if not re.match(pattern, v):
        raise ValueError(PASSWORD_DESC)
    return v

class LoginRequest(BaseModel):
    identifier: str
    password: str

class RoleResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class UserResponse(BaseModel):
    identifier: str
    role: RoleResponse
    is_temp_password: bool
    nombre_completo: Optional[str] = None

    class Config:
        from_attributes = True

class PasswordChangeRequest(BaseModel):
    identifier: str
    current_password: str
    new_password: str = Field(..., min_length=8, description=PASSWORD_DESC)
    confirm_password: str

    # Validamos usando una función pura de Python
    @field_validator('new_password')
    @classmethod
    def check_password_strength(cls, v: str) -> str:
        return validate_secure_password(v)

class ForgotPasswordRequest(BaseModel):
    identifier: str

class ValidateCodeRequest(BaseModel):
    identifier: str
    code: str

class ResetPasswordRequest(BaseModel):
    identifier: str
    code: str
    new_password: str = Field(..., min_length=8, description=PASSWORD_DESC)
    confirm_password: str

    # Reutilizamos la misma validación aquí
    @field_validator('new_password')
    @classmethod
    def check_password_strength(cls, v: str) -> str:
        return validate_secure_password(v)