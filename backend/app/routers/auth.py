import smtplib
import secrets
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.db.database import get_db
from app.models.user import User
from app.models.password_reset_code import PasswordResetCode
from app.schemas.auth import (
    LoginRequest, UserResponse, PasswordChangeRequest,
    ForgotPasswordRequest, ValidateCodeRequest, ResetPasswordRequest
)
from app.core.security import verify_password, get_password_hash

from app.models.administrator import Administrator
from app.models.teacher import Teacher
from app.models.student import Student
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/auth", tags=["auth"])

class AdminForcePasswordRequest(BaseModel):
    identifier: str
    new_password: str
    admin_id: str = "Sistema"

@router.post("/login", response_model=UserResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    generic_error = "ID o contraseña incorrectos"
    tz = ZoneInfo("America/Merida")

    user = (
        db.query(User)
        .filter(or_(User.identifier == data.identifier, User.email == data.identifier))
        .first()
    )

    if not user:
        raise HTTPException(status_code=401, detail=generic_error)

    if user.is_locked:
        raise HTTPException(
            status_code=403,
            detail="La cuenta está bloqueada por seguridad. Contacte al administrador."
        )

    if user.is_temp_password and user.created_at:
        ahora = datetime.now(tz).replace(tzinfo=None)
        if ahora - user.created_at > timedelta(days=15):
            user.is_locked = True
            user.locked_at = ahora
            log_audit_event(db, user.identifier, "UPDATE", "users", user.identifier, {"is_locked": False}, {"is_locked": True, "motivo": "Contraseña temporal vencida"})
            db.commit()
            raise HTTPException(status_code=403, detail="Cuenta bloqueada por no cambiar la contraseña temporal en 15 días.")

    if not verify_password(data.password, user.password_hash):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        user.last_failed_attempt_at = datetime.now(tz).replace(tzinfo=None)
        attempts = user.failed_login_attempts

        if attempts >= 5:
            user.is_locked = True
            user.locked_at = datetime.now(tz).replace(tzinfo=None)
            log_audit_event(db, data.identifier, "UPDATE", "users", user.identifier, {"is_locked": False}, {"is_locked": True, "motivo": "Exceso de intentos"})
            db.commit()
            raise HTTPException(status_code=403, detail="Tu cuenta ha sido bloqueada por demasiados intentos fallidos.")

        db.commit()
        remaining = 5 - attempts
        if remaining <= 2:
            raise HTTPException(status_code=401, detail=f"ID o contraseña incorrectos. Te queda{'n' if remaining > 1 else ''} {remaining} intento{'s' if remaining > 1 else ''} antes del bloqueo.")
        raise HTTPException(status_code=401, detail=generic_error)

    user.failed_login_attempts = 0
    user.last_login = datetime.now(tz).replace(tzinfo=None)
    log_audit_event(db, user.identifier, "LOGIN", "users", user.identifier, None, None)
    db.commit()
    db.refresh(user)

    nombre_completo = "Usuario del Sistema"
    if user.role:
        role_name = user.role.name.lower()
        perfil = None

        if role_name in ["admin", "super_admin"]:
            perfil = db.query(Administrator).filter(Administrator.numero_empleado == user.identifier).first()
        elif role_name == "docente":
            perfil = db.query(Teacher).filter(Teacher.matricula_empleado == user.identifier).first()
        elif role_name == "alumno":
            perfil = db.query(Student).filter(Student.matricula == user.identifier).first()

        if perfil:
            partes = [getattr(perfil, "nombre", ""), getattr(perfil, "apellido_paterno", ""), getattr(perfil, "apellido_materno", "")]
            nombre_completo = " ".join(filter(None, partes)).strip()
            setattr(user, "email_personal", getattr(perfil, "email_personal", None))
            setattr(user, "email_institucional", getattr(perfil, "email_institucional", None))
            setattr(user, "foto_id", getattr(perfil, "foto_id", None))

    setattr(user, "nombre_completo", nombre_completo)
    return user

@router.put("/change-password")
def change_password(data: PasswordChangeRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.identifier == data.identifier).first()
    if not user: raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if not verify_password(data.current_password, user.password_hash): raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    if data.new_password != data.confirm_password: raise HTTPException(status_code=400, detail="Las contraseñas no coinciden")
    
    user.password_hash = get_password_hash(data.new_password)
    user.is_temp_password = False
    log_audit_event(db, data.identifier, "UPDATE", "users", data.identifier, None, {"evento": "Cambio de contraseña"})
    db.commit()
    return {"message": "Contraseña actualizada exitosamente"}

@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.identifier).first()
    if not user: raise HTTPException(status_code=404, detail="Correo no registrado")

    db.query(PasswordResetCode).filter(PasswordResetCode.user_id == user.id, PasswordResetCode.is_used == False).update({"is_used": True})
    reset_code = ''.join(secrets.choice(string.digits) for _ in range(6))
    expires = datetime.now(ZoneInfo("America/Merida")).replace(tzinfo=None) + timedelta(minutes=10)

    db_code = PasswordResetCode(user_id=user.id, reset_code=reset_code, expires_at=expires)
    db.add(db_code)
    db.commit()

    try:
        remitente, pwd = "sesacorp10@gmail.com", "enecpjvwkoseedip"
        msg = MIMEMultipart()
        msg['From'], msg['To'], msg['Subject'] = remitente, user.email, "Código de Recuperación - SESA"
        cuerpo = f"Tu código es: {reset_code}. Expira en 10 min."
        msg.attach(MIMEText(cuerpo, 'plain'))
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(remitente, pwd)
        server.sendmail(remitente, user.email, msg.as_string())
        server.quit()
    except Exception: pass
    return {"message": "Código enviado"}

@router.post("/validate-reset-code")
def validate_reset_code(data: ValidateCodeRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.identifier).first()
    if not user: raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    ahora = datetime.now(ZoneInfo("America/Merida")).replace(tzinfo=None)
    code_record = db.query(PasswordResetCode).filter(
        PasswordResetCode.user_id == user.id,
        PasswordResetCode.reset_code == data.code,
        PasswordResetCode.is_used == False,
        PasswordResetCode.expires_at > ahora
    ).first()

    if not code_record: raise HTTPException(status_code=400, detail="Código inválido o expirado")
    code_record.is_used = True
    db.commit()
    return {"message": "Código válido", "identifier": user.identifier}

@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    if data.new_password != data.confirm_password: raise HTTPException(status_code=400, detail="No coinciden")
    user = db.query(User).filter(User.identifier == data.identifier).first()
    if not user: raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user.password_hash = get_password_hash(data.new_password)
    user.is_temp_password = False
    log_audit_event(db, data.identifier, "UPDATE", "users", data.identifier, None, {"evento": "Reset con código"})
    db.commit()
    return {"message": "Éxito"}

@router.put("/admin-force-password")
def admin_force_password(data: AdminForcePasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.identifier == data.identifier).first()
    if not user: raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user.password_hash = get_password_hash(data.new_password)
    user.is_temp_password, user.is_locked, user.failed_login_attempts = True, False, 0
    log_audit_event(db, data.admin_id, "UPDATE", "users", data.identifier, None, {"evento": "Password forzada"})
    db.commit()
    return {"message": "Éxito"}