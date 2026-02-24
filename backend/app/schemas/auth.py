from pydantic import BaseModel, EmailStr
from typing import Optional

class LoginRequest(BaseModel):
    identifier: str 
    password: str

class UserResponse(BaseModel):
    identifier: str
    role: str
    is_temp_password: bool

    class Config:
        from_attributes = True