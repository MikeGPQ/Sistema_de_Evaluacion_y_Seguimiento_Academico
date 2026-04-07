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
    
    if action == 'UPDATE' and not new_values:
        return

    audit_entry = AuditLog(
        user_identifier=str(user_identifier) if user_identifier else "SISTEMA",
        action=action.upper(),
        entity_name=entity_name.lower(),
        entity_id=str(entity_id),
        old_values=old_values if old_values else None,
        new_values=new_values if new_values else None,
        ip_address=ip_address,
    )

    db.add(audit_entry)
    db.flush()