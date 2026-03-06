import smtplib
import secrets
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from pydantic import BaseModel, EmailStr
from typing import List, Optional

from app.db.database import get_db
from app.models.administrator import Administrator
from app.models.user import User
from app.models.role import Role
from app.core.security import get_password_hash
from app.models.student import Student

router = APIRouter(prefix="/administradores", tags=["Administradores"])

class AdminItem(BaseModel):
    numero_empleado: str
    nombre_completo: str
    email_institucional: Optional[str] = None
    estatus: str

class PaginatedAdminResponse(BaseModel):
    data: List[AdminItem]
    total: int

class AdminCreate(BaseModel):
    nombre: str
    apellido_paterno: str
    apellido_materno: str
    email_institucional: EmailStr

@router.get("/listado", response_model=PaginatedAdminResponse)
def get_administrators(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, le=100),
    busqueda: Optional[str] = None,
    estatus: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Administrator)
    
    if busqueda:
        termino = f"%{busqueda}%"
        nombre_completo_db = func.concat(
            Administrator.nombre, ' ', 
            Administrator.apellido_paterno, ' ', 
            Administrator.apellido_materno
        )
        query = query.filter(
            or_(
                Administrator.numero_empleado.ilike(termino),
                nombre_completo_db.ilike(termino)
            )
        )
    
    if estatus:
        is_active_val = True if estatus.lower() == 'activo' else False
        query = query.filter(Administrator.is_active == is_active_val)

    total_registros = query.count()
    administradores_db = query.offset(skip).limit(limit).all()
    
    lista_formateada = []
    for admin in administradores_db:
        partes_nombre = [admin.nombre, admin.apellido_paterno, admin.apellido_materno]
        nombre_completo = " ".join(filter(None, partes_nombre)).strip()
        
        lista_formateada.append({
            "numero_empleado": admin.numero_empleado,
            "nombre_completo": nombre_completo,
            "email_institucional": admin.email_institucional,
            "estatus": "Activo" if admin.is_active else "Inactivo"
        })
        
    return {"data": lista_formateada, "total": total_registros}

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_admin(admin_data: AdminCreate, db: Session = Depends(get_db)):
    # 1. Validación de existencia en User
    existing_user = db.query(User).filter(User.email == admin_data.email_institucional).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="El correo institucional ya está registrado en el sistema."
        )

    try:
        # 2. Generación automática del ID
        max_admin = db.query(func.max(Administrator.numero_empleado)).scalar()
        max_student = db.query(func.max(Student.matricula)).scalar()
        max_user = db.query(func.max(User.identifier)).scalar()
        
        numeros_existentes = []
        for valor in [max_admin, max_student, max_user]:
            if valor and str(valor).isdigit():
                numeros_existentes.append(int(valor))
        
        # Si no hay registros, iniciar en 1. De lo contrario, sumar 1 al máximo.
        siguiente_id = max(numeros_existentes) + 1 if numeros_existentes else 1
        nuevo_numero_empleado = str(siguiente_id).zfill(8) 

        # Verificación de redundancia para evitar colisiones
        while db.query(User).filter(User.identifier == nuevo_numero_empleado).first():
            siguiente_id += 1
            nuevo_numero_empleado = str(siguiente_id).zfill(8)

        # 3. Generación de contraseña
        alphabet = string.ascii_letters + string.digits
        raw_password = ''.join(secrets.choice(alphabet) for _ in range(10))
        hashed_password = get_password_hash(raw_password)

        admin_role = db.query(Role).filter(Role.name == "admin").first()
        if not admin_role:
             raise HTTPException(status_code=500, detail="El rol 'admin' no existe.")

        # 4. Creación de User 
        new_user = User(
            identifier=nuevo_numero_empleado, 
            email=admin_data.email_institucional,
            password_hash=hashed_password, 
            role_id=admin_role.id,
            is_temp_password=True
        )
        db.add(new_user)

        # 5. Creación de Administrator
        new_admin = Administrator(
            numero_empleado=nuevo_numero_empleado,
            nombre=admin_data.nombre,
            apellido_paterno=admin_data.apellido_paterno,
            apellido_materno=admin_data.apellido_materno,
            email_institucional=admin_data.email_institucional,
            is_active=True 
        )
        db.add(new_admin)

        db.commit()

        try:
            remitente = "sesacorp10@gmail.com"
            password_aplicacion = "enecpjvwkoseedip"

            msg = MIMEMultipart()
            msg['From'] = remitente
            msg['To'] = admin_data.email_institucional
            msg['Subject'] = "¡Bienvenido a SESA! Cuenta de Administrador Creada"

            cuerpo_html = f"""
            <!DOCTYPE html>
            <html>
            <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; margin: 0; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                    <div style="background-color: #1A237E; padding: 25px; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px; color: #ffffff;">Sistema Escolar SESA</h1>
                    </div>
                    <div style="padding: 30px; color: #374151; line-height: 1.6;">
                        <h2 style="margin-top: 0; font-size: 20px; color: #111827;">¡Hola, {admin_data.nombre}!</h2>
                        <p style="font-size: 16px;">Se ha creado tu cuenta de administrador exitosamente.</p>
                        <div style="background-color: #f8fafc; border-left: 5px solid #1A237E; padding: 20px; margin: 30px 0;">
                            <p style="margin: 8px 0; font-size: 16px;"><strong>ID Empleado:</strong> {nuevo_numero_empleado}</p>
                            <p style="margin: 8px 0; font-size: 16px;"><strong>Contraseña temporal:</strong> {raw_password}</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
            """
            msg.attach(MIMEText(cuerpo_html, 'html'))
            server = smtplib.SMTP('smtp.gmail.com', 587)
            server.starttls()
            server.login(remitente, password_aplicacion)
            server.sendmail(remitente, admin_data.email_institucional, msg.as_string())
            server.quit()
        except Exception as email_err:
            print(f"Registro exitoso, pero fallo correo: {email_err}")

        return {
            "message": "Administrador creado exitosamente",
            "numero_empleado": new_admin.numero_empleado
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")