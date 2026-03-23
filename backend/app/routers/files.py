from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.file import File

router = APIRouter(prefix="/files", tags=["files"])

@router.get("/{file_id}")
def get_file(file_id: int, db: Session = Depends(get_db)):
    # 1. Recuperar el registro binario de la base de datos
    file = db.query(File).filter(File.id == file_id).first()
    
    if not file:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    # 2. Retornar el contenido con el MIME Type correcto (image/jpeg, application/pdf, etc.)
    return Response(
        content=bytes(file.file_content),
        media_type=file.mime_type,
        headers={
            "Cache-Control": "max-age=86400",  # Cache de 24 horas para optimizar el frontend
            "Content-Disposition": f'inline; filename="{file.filename}"'
        },
    )