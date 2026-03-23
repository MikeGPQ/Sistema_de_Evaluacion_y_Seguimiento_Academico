from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog

def log_audit_event(
    db: Session,
    user_identifier: str,
    action: str,
    entity_name: str,
    entity_id: str,
    old_values: dict = None,
    new_values: dict = None,
    ip_address: str = None,
):
    """
    Registra un evento en la 'Caja Negra' (audit_logs).
    """
    if action == 'UPDATE' and not new_values:
        return

    audit_entry = AuditLog(
        user_identifier=str(user_identifier) if user_identifier is not None else None,
        action=action,
        entity_name=entity_name,
        entity_id=str(entity_id),
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address,
    )

    db.add(audit_entry)

    # NOTA ARQUITECTÓNICA:
    # No hacemos db.commit() aquí a propósito. El commit se hará en el router
    # principal para garantizar que la calificación y el log se guarden juntos,
    # o si algo falla, se cancelen juntos (Atomicidad).