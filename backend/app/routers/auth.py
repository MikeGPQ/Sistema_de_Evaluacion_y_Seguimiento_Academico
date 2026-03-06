from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime

from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, UserResponse, PasswordChangeRequest
from app.core.security import verify_password, get_password_hash

from app.models.administrator import Administrator
from app.models.teacher import Teacher
from app.models.student import Student

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=UserResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    generic_error = "ID o contraseña incorrectos"

    user = (
        db.query(User)
        .filter(or_(User.identifier == data.identifier, User.email == data.identifier))
        .first()
    )

    if not user:
        raise HTTPException(status_code=401, detail=generic_error)

    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail=generic_error)

    user.last_login = datetime.utcnow()
    db.commit()
    db.refresh(user)

    nombre_completo = "Usuario del Sistema"

    if getattr(user, "role", None):
        role_name = user.role.name.lower()
        perfil = None
        
        if role_name in ["admin", "super_admin"]:
            perfil = db.query(Administrator).filter(Administrator.numero_empleado == user.identifier).first()
        elif role_name == "docente":
            perfil = db.query(Teacher).filter(Teacher.external_id == user.identifier).first()
        elif role_name == "alumno":
            perfil = db.query(Student).filter(Student.matricula == user.identifier).first()

        if perfil:
            partes = [
                getattr(perfil, "nombre", ""),
                getattr(perfil, "apellido_paterno", ""),
                getattr(perfil, "apellido_materno", "")
            ]
            nombre_completo = " ".join(filter(None, partes)).strip()

    setattr(user, "nombre_completo", nombre_completo)

    return user


@router.put("/change-password")
def change_password(data: PasswordChangeRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.identifier == data.identifier).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")

    if data.new_password != data.confirm_password:
        raise HTTPException(status_code=400, detail="Las contraseñas no coinciden")

    if verify_password(data.new_password, user.password_hash):
        raise HTTPException(status_code=400, detail="La nueva contraseña no puede ser igual a la actual")

    user.password_hash = get_password_hash(data.new_password)
    user.is_temp_password = False

    db.commit()
    db.refresh(user)

    return {"message": "Contraseña actualizada exitosamente"}