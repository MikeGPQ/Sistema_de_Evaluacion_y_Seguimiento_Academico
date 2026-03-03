from pydantic import BaseModel, Field

class LoginRequest(BaseModel):
    identifier: str
    password: str

class UserResponse(BaseModel):
    identifier: str
    role: str
    is_temp_password: bool

    class Config:
        from_attributes = True

class PasswordChangeRequest(BaseModel):
    # Como ahorita NO tienes JWT, mantenemos identifier.
    # (Más abajo te digo cómo se mejora cuando metan token.)
    identifier: str
    current_password: str
    new_password: str = Field(..., min_length=8, description="Mínimo 8 caracteres")
    confirm_password: str