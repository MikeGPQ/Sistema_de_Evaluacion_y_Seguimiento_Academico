from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from pydantic import BaseModel, EmailStr
from typing import List, Optional
import pandas as pd
from fastapi.responses import StreamingResponse
import io
from fastapi import UploadFile, File

from app.db.database import get_db
from app.models.administrator import Administrator
from app.models.user import User
from app.models.role import Role
from app.core.security import get_password_hash

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
    numero_empleado: str
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

