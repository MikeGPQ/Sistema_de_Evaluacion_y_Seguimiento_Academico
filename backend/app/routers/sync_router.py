from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.sigad_sync_service import sincronizar_todo
from pydantic import BaseModel

router = APIRouter(prefix="/api/sync", tags=["Sincronización SIGAD"])

class SyncRequest(BaseModel):
    usuario_id: str = "Sistema"


@router.post("/sigad")
def sync_sigad(request: SyncRequest = None, db: Session = Depends(get_db)):
    user_id = request.usuario_id if request else "Sistema"
    resultado = sincronizar_todo(db, usuario_id=user_id)
    return resultado
