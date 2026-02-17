from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica si la contraseña coincide con el hash.
    Bcrypt ignorará cualquier cosa después de los 72 caracteres, 
    lo cual es normal en este estándar.
    """
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False