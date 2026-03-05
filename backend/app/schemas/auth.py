from pydantic import BaseModel, Field
from typing import Optional

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
    new_password: str = Field(..., min_length=8, description="Mínimo 8 caracteres")
    confirm_password: str