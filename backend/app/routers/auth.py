from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db 
from app.models.user import User
from app.schemas.auth import LoginRequest, UserResponse
from app.core.security import verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=UserResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    # 1. Buscamos al usuario por su identifier (Matrícula/ID)
    user = db.query(User).filter(User.identifier == data.identifier).first()
    
    # 2. Mensaje genérico 
    generic_error = "Correo o contraseña incorrectos"
    
    if not user:
        raise HTTPException(status_code=401, detail=generic_error)
    
    # 3. Verificamos la contraseña usando passlib
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail=generic_error)
    
    # 4. Retornamos la info necesaria para el Front (Rol y Flag de Contraseña Temporal) 
    return user