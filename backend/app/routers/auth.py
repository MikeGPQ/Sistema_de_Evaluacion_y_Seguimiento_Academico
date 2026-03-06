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

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=UserResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    generic_error = "ID o contraseña incorrectos"

    user = (
        db.query(User)
        .filter(or_(User.identifier == data.identifier, User.email == data.identifier))
        .first()
    )

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail=generic_error)

    user.last_login = datetime.utcnow()
    db.commit()
    db.refresh(user)

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

    return {"message": "Contraseña actualizada exitosamente"}

# ==========================================
# HU-32: FLUJO DE RECUPERACIÓN DE CONTRASEÑA
# ==========================================

@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        or_(User.identifier == data.identifier, User.email == data.identifier)
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=404, 
            detail="El correo o ID ingresado no se encuentra registrado en el sistema."
        )

    # Invalida códigos anteriores para que solo el nuevo sea válido
    db.query(PasswordResetCode).filter(
        PasswordResetCode.user_id == user.id,
        PasswordResetCode.is_used == False
    ).update({"is_used": True})
    db.commit()

    # Generar código de 6 dígitos
    reset_code = ''.join(secrets.choice(string.digits) for _ in range(6))
    
    # Hora de Mérida para la base de datos
    ahora_merida = datetime.now(ZoneInfo("America/Merida")).replace(tzinfo=None)
    expires = ahora_merida + timedelta(minutes=10)

    db_code = PasswordResetCode(
        user_id=user.id,
        reset_code=reset_code,
        expires_at=expires
    )
    db.add(db_code)
    db.commit()

    # Envío de correo
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
    user = db.query(User).filter(
        or_(User.identifier == data.identifier, User.email == data.identifier)
    ).first()
    
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
    
    # El código se marca como usado aquí para evitar reutilización
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

    # Eliminamos la búsqueda del código aquí, ya que fue validado y marcado 
    # como 'is_used=True' en el paso anterior (validate-reset-code).
    
    user.password_hash = get_password_hash(data.new_password)
    user.is_temp_password = False
    
    db.commit()
    return {"message": "Contraseña recuperada exitosamente"}