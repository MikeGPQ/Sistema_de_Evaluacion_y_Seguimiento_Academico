from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
from typing import Optional
from pydantic import BaseModel

from app.db.database import get_db
from app.models.audit_log import AuditLog
from app.models.user import User

router = APIRouter(prefix="/logs", tags=["Auditoría"])



class UnlockRequest(BaseModel):
    usuario_id: str = "Sistema"

@router.get("/listado")
def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(15, le=100),
    usuario_id: Optional[str] = None,
    modulo: Optional[str] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    db: Session = Depends(get_db)
):
    # 1. KPIs y Usuarios Bloqueados
    usuarios_activos = db.query(User).filter(User.is_locked == False).count()
    
    locked_users_db = db.query(User.identifier, User.email, User.locked_at).filter(User.is_locked == True).all()
    usuarios_inactivos_count = len(locked_users_db)
    
    locked_users_data = [
        {
            "identifier": u.identifier,
            "email": u.email,
            "locked_at": u.locked_at.isoformat() if u.locked_at else None
        } for u in locked_users_db
    ]

    # 2. Consulta de logs
    query = db.query(
        AuditLog,
        User.role_id 
    ).outerjoin(
        User, AuditLog.user_identifier == User.identifier
    )

    # 3. Filtros
    if usuario_id:
        termino_busqueda = f"%{usuario_id}%"
        query = query.filter(AuditLog.user_identifier.ilike(termino_busqueda))
    if modulo:
        query = query.filter(AuditLog.entity_name == modulo)
    if fecha_desde:
        query = query.filter(func.date(AuditLog.created_at) >= fecha_desde)
    if fecha_hasta:
        query = query.filter(func.date(AuditLog.created_at) <= fecha_hasta)

    # 4. Paginación
    total_registros = query.count()
    resultados = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()

    mapa_roles = {1: "ADMIN", 2: "DOCENTE", 3: "ALUMNO", 4: "SUPER ADMIN"}

    # 5. Formato
    data = []
    for log, role_id in resultados:
        data.append({
            "id": log.id,
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "user_identifier": log.user_identifier,
            "user_role": mapa_roles.get(role_id, "SISTEMA"),
            "action": log.action,
            "entity_name": log.entity_name,
            "old_values": log.old_values,
            "new_values": log.new_values
        })

    return {
        "data": data,
        "total": total_registros,
        "kpis": {
            "activos": usuarios_activos,
            "inactivos": usuarios_inactivos_count
        },
        "locked_users": locked_users_data 
    }

@router.get("/locked-users")
def get_locked_users(db: Session = Depends(get_db)):
    locked_users = db.query(
        User.identifier, 
        User.email, 
        User.locked_at
    ).filter(User.is_locked == True).all()
    
    data = []
    for user in locked_users:
        data.append({
            "identifier": user.identifier,
            "email": user.email,
            "locked_at": user.locked_at.isoformat() if user.locked_at else None
        })
        
    return {"data": data}

@router.put("/unlock-user/{identifier}")
def unlock_user(identifier: str, data: UnlockRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.identifier == identifier).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if not user.is_locked:
        raise HTTPException(status_code=400, detail="User is already unlocked")

    user.is_locked = False
    user.locked_at = None
    user.failed_login_attempts = 0

    audit_log = AuditLog(
        user_identifier=data.usuario_id, 
        action="UPDATE",
        entity_name="users",
        entity_id=identifier,
        old_values={"is_locked": True},
        new_values={"is_locked": False, "evento": "Desbloqueo"}
    )
    
    db.add(audit_log)
    db.commit()

    return {"message": "User unlocked successfully"}