from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.file import File

router = APIRouter(prefix="/files", tags=["files"])


@router.get("/{file_id}")
def get_file(file_id: int, db: Session = Depends(get_db)):
    file = db.query(File).filter(File.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    return Response(
        content=bytes(file.file_content),
        media_type=file.mime_type,
        headers={"Cache-Control": "max-age=86400"},
    )
