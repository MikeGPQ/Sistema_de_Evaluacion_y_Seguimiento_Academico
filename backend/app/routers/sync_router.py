from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.sigad_sync_service import sincronizar_todo

router = APIRouter(prefix="/api/sync", tags=["Sincronización SIGAD"])


@router.post("/sigad")
def sync_sigad(db: Session = Depends(get_db)):
    resultado = sincronizar_todo(db)
    return resultado
