from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
from typing import Optional

from app.db.database import get_db
from app.models.audit_log import AuditLog
from app.models.user import User

router = APIRouter(prefix="/logs", tags=["Auditoría"])

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
    # 1. KPIs 
    usuarios_activos = db.query(User).filter(User.is_locked == False).count()
    usuarios_inactivos = db.query(User).filter(User.is_locked == True).count()

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
            "entity_id": log.entity_id,
            "old_values": log.old_values,
            "new_values": log.new_values
        })

    return {
        "data": data,
        "total": total_registros,
        "kpis": {
            "activos": usuarios_activos,
            "inactivos": usuarios_inactivos
        }
    }