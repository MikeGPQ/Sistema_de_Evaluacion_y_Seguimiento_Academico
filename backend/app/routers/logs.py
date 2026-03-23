from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
from typing import Optional, List
from pydantic import BaseModel

from app.db.database import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.models.role import Role

router = APIRouter(prefix="/logs", tags=["Auditoría"])

class UnlockRequest(BaseModel):
    admin_identifier: str = "Sistema"

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
    usuarios_activos = db.query(User).filter(User.is_locked == False).count()
    usuarios_bloqueados = db.query(User).filter(User.is_locked == True).all()
    
    locked_users_data = [
        {
            "identifier": u.identifier,
            "email": u.email,
            "locked_at": u.locked_at.isoformat() if u.locked_at else None,
            "failed_attempts": u.failed_login_attempts
        } for u in usuarios_bloqueados
    ]

    query = db.query(AuditLog, Role.name).outerjoin(
        User, AuditLog.user_identifier == User.identifier
    ).outerjoin(
        Role, User.role_id == Role.id
    )

    if usuario_id:
        query = query.filter(AuditLog.user_identifier.ilike(f"%{usuario_id}%"))
    if modulo:
        query = query.filter(AuditLog.entity_name == modulo)
    if fecha_desde:
        query = query.filter(func.date(AuditLog.created_at) >= fecha_desde)
    if fecha_hasta:
        query = query.filter(func.date(AuditLog.created_at) <= fecha_hasta)

    total = query.count()
    resultados = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()

    data = []
    for log, role_name in resultados:
        data.append({
            "id": log.id,
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "user_identifier": log.user_identifier,
            "user_role": role_name or "SISTEMA/DESCONOCIDO",
            "action": log.action,
            "entity_name": log.entity_name,
            "old_values": log.old_values,
            "new_values": log.new_values
        })

    return {
        "data": data,
        "total": total,
        "kpis": {
            "activos": usuarios_activos,
            "bloqueados": len(locked_users_data)
        },
        "locked_users": locked_users_data 
    }

@router.put("/unlock-user/{identifier}")
def unlock_user(identifier: str, data: UnlockRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.identifier == identifier).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    if not user.is_locked:
        raise HTTPException(status_code=400, detail="El usuario no se encuentra bloqueado")

    user.is_locked = False
    user.locked_at = None
    user.failed_login_attempts = 0

    new_log = AuditLog(
        user_identifier=data.admin_identifier, 
        action="UPDATE",
        entity_name="users",
        entity_id=identifier,
        old_values={"is_locked": True},
        new_values={"is_locked": False, "evento": "Desbloqueo Manual por Administrador"}
    )
    
    db.add(new_log)
    db.commit()

    return {"message": f"Usuario {identifier} desbloqueado exitosamente"}