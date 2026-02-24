from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db 
from app.models.user import User
from app.schemas.auth import LoginRequest, UserResponse
from app.core.security import verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=UserResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.identifier == data.identifier).first()
    
    generic_error = "Correo o contraseña incorrectos"
    
    if not user:
        raise HTTPException(status_code=401, detail=generic_error)
    
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail=generic_error)
    
    return user