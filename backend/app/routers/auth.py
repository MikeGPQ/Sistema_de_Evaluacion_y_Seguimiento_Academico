from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime

from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, UserResponse, PasswordChangeRequest
from app.core.security import verify_password, get_password_hash

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=UserResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    generic_error = "ID o contraseña incorrectos"

    # ✅ Soporta login por identifier o por email (porque tu UI dice “ID O CORREO”)
    user = (
        db.query(User)
        .filter(or_(User.identifier == data.identifier, User.email == data.identifier))
        .first()
    )

    if not user:
        raise HTTPException(status_code=401, detail=generic_error)

    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail=generic_error)

    # ✅ Registrar last_login (opcional, pero útil)
    user.last_login = datetime.utcnow()
    db.commit()
    db.refresh(user)

    return user


@router.put("/change-password")
def change_password(data: PasswordChangeRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.identifier == data.identifier).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # ✅ Validación de identidad: contraseña actual obligatoria
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")

    # ✅ Confirmación: nueva contraseña repetida
    if data.new_password != data.confirm_password:
        raise HTTPException(status_code=400, detail="Las contraseñas no coinciden")

    # ✅ Recomendado: evitar misma contraseña
    if verify_password(data.new_password, user.password_hash):
        raise HTTPException(status_code=400, detail="La nueva contraseña no puede ser igual a la actual")

    # ✅ Actualización inmediata
    user.password_hash = get_password_hash(data.new_password)
    user.is_temp_password = False

    db.commit()
    db.refresh(user)

    return {"message": "Contraseña actualizada exitosamente"}