import smtplib
import secrets
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

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

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=UserResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    generic_error = "ID o contraseña incorrectos"

    user = (
        db.query(User)
        .filter(or_(User.identifier == data.identifier, User.email == data.identifier))
        .first()
    )

    # Usuario no encontrado
    if not user:
        raise HTTPException(status_code=401, detail=generic_error)

    # Verificar si la cuenta está bloqueada
    if user.is_locked:
        raise HTTPException(
            status_code=403,
            detail="La cuenta está bloqueada por seguridad. Contacte al administrador."
        )

    # Verificar contraseña temporal vencida (15 días)
    if user.is_temp_password and user.created_at:
        ahora_merida = datetime.now(ZoneInfo("America/Merida")).replace(tzinfo=None)
        if ahora_merida - user.created_at > timedelta(days=15):
            user.is_locked = True
            user.locked_at = ahora_merida
            db.commit()
            raise HTTPException(
                status_code=403,
                detail="Cuenta bloqueada por no cambiar la contraseña temporal en 15 días."
            )

    # Verificar contraseña
    if not verify_password(data.password, user.password_hash):

        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        attempts = user.failed_login_attempts

        if attempts >= 5:
            user.is_locked = True
            user.locked_at = datetime.now(ZoneInfo("America/Merida")).replace(tzinfo=None)
            db.commit()
            raise HTTPException(
                status_code=403,
                detail="Tu cuenta ha sido bloqueada por demasiados intentos fallidos. Contacta al administrador."
            )

        db.commit()

        remaining = 5 - attempts
        if remaining <= 2:
            raise HTTPException(
                status_code=401,
                detail=f"ID o contraseña incorrectos. Advertencia: te queda{'n' if remaining > 1 else ''} {remaining} intento{'s' if remaining > 1 else ''} antes de que tu cuenta sea bloqueada."
            )

        raise HTTPException(status_code=401, detail=generic_error)

    # Login correcto
    user.failed_login_attempts = 0
    user.last_login = datetime.now(ZoneInfo("America/Merida")).replace(tzinfo=None)

    db.commit()
    db.refresh(user)

    nombre_completo = "Usuario del Sistema"

    if getattr(user, "role", None):
        role_name = user.role.name.lower()
        perfil = None

        if role_name in ["admin", "super_admin"]:
            perfil = db.query(Administrator).filter(
                Administrator.numero_empleado == user.identifier
            ).first()

        elif role_name == "docente":
            perfil = db.query(Teacher).filter(
                Teacher.external_id == user.identifier
            ).first()

        elif role_name == "alumno":
            perfil = db.query(Student).filter(
                Student.matricula == user.identifier
            ).first()

        if perfil:
            partes = [
                getattr(perfil, "nombre", ""),
                getattr(perfil, "apellido_paterno", ""),
                getattr(perfil, "apellido_materno", "")
            ]

            nombre_completo = " ".join(filter(None, partes)).strip()

            setattr(user, "email_personal", getattr(perfil, "email_personal", None))
            setattr(user, "email_institucional", getattr(perfil, "email_institucional", None))
            setattr(user, "foto_id", getattr(perfil, "foto_id", None))

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
        raise HTTPException(
            status_code=400,
            detail="La nueva contraseña no puede ser igual a la actual"
        )

    user.password_hash = get_password_hash(data.new_password)
    user.is_temp_password = False

    db.commit()

    return {"message": "Contraseña actualizada exitosamente"}


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.identifier).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="El correo electrónico ingresado no se encuentra registrado en el sistema."
        )

    db.query(PasswordResetCode).filter(
        PasswordResetCode.user_id == user.id,
        PasswordResetCode.is_used == False
    ).update({"is_used": True})

    db.commit()

    reset_code = ''.join(secrets.choice(string.digits) for _ in range(6))

    ahora_merida = datetime.now(ZoneInfo("America/Merida")).replace(tzinfo=None)
    expires = ahora_merida + timedelta(minutes=10)

    db_code = PasswordResetCode(
        user_id=user.id,
        reset_code=reset_code,
        expires_at=expires
    )

    db.add(db_code)
    db.commit()

    try:
        remitente = "sesacorp10@gmail.com"
        password_aplicacion = "enecpjvwkoseedip"

        msg = MIMEMultipart()
        msg['From'] = remitente
        msg['To'] = user.email
        msg['Subject'] = "Código de Recuperación de Contraseña - SESA"

        cuerpo_html = f"""
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #0B172A; text-align: center;">Recuperación de Acceso</h2>
            <p>Hola, has solicitado restablecer tu contraseña en el portal SESA.</p>
            <p>Tu código de seguridad temporal es:</p>
            <div style="text-align: center; margin: 20px 0;">
                <span style="font-size: 24px; font-weight: bold; background: #f3f4f6; padding: 10px 20px; letter-spacing: 5px; border-radius: 5px; color: #1a1a1a;">
                    {reset_code}
                </span>
            </div>
            <p style="color: #666; font-size: 12px;">Este código expirará en 10 minutos. Si no solicitaste este cambio, ignora este correo.</p>
        </div>
        """

        msg.attach(MIMEText(cuerpo_html, 'html'))

        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(remitente, password_aplicacion)
        server.sendmail(remitente, user.email, msg.as_string())
        server.quit()

    except Exception as e:
        print(f"Error enviando correo: {e}")

    return {"message": "Código enviado exitosamente"}


@router.post("/validate-reset-code")
def validate_reset_code(data: ValidateCodeRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.identifier).first()

    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    ahora_merida = datetime.now(ZoneInfo("America/Merida")).replace(tzinfo=None)

    code_record = db.query(PasswordResetCode).filter(
        PasswordResetCode.user_id == user.id,
        PasswordResetCode.reset_code == data.code,
        PasswordResetCode.is_used == False,
        PasswordResetCode.expires_at > ahora_merida
    ).first()

    if not code_record:
        raise HTTPException(status_code=400, detail="El código es incorrecto o ha expirado.")

    code_record.is_used = True
    db.commit()

    return {"message": "Código válido", "identifier": user.identifier}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    if data.new_password != data.confirm_password:
        raise HTTPException(status_code=400, detail="Las contraseñas no coinciden")

    user = db.query(User).filter(User.identifier == data.identifier).first()

    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if verify_password(data.new_password, user.password_hash):
        raise HTTPException(
            status_code=400,
            detail="La nueva contraseña no puede ser igual a la contraseña actual."
        )

    user.password_hash = get_password_hash(data.new_password)
    user.is_temp_password = False

    db.commit()

    return {"message": "Contraseña recuperada exitosamente"}