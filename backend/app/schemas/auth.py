import re
from typing import Optional
from pydantic import BaseModel, Field, field_validator, EmailStr

PASSWORD_DESC = "Mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial"

def validate_secure_password(v: str) -> str:
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
    is_locked: bool
    nombre_completo: Optional[str] = None
    email_personal: Optional[str] = None
    email_institucional: Optional[str] = None
    foto_id: Optional[int] = None

    class Config:
        from_attributes = True

class PasswordChangeRequest(BaseModel):
    identifier: str
    current_password: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str

    @field_validator('new_password')
    @classmethod
    def check_password_strength(cls, v: str) -> str:
        return validate_secure_password(v)

class ForgotPasswordRequest(BaseModel):
    identifier: EmailStr

class ValidateCodeRequest(BaseModel):
    identifier: str
    code: str

class ResetPasswordRequest(BaseModel):
    identifier: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str

    @field_validator('new_password')
    @classmethod
    def check_password_strength(cls, v: str) -> str:
        return validate_secure_password(v)