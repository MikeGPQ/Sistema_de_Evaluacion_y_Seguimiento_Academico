from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.file import File

router = APIRouter(prefix="/files", tags=["files"])


def content_disposition(filename: str) -> str:
    # ASCII-safe fallback for the legacy filename param
    ascii_name = filename.encode("ascii", errors="replace").decode("ascii")
    encoded_name = quote(filename, safe="")
    return f"inline; filename=\"{ascii_name}\"; filename*=UTF-8''{encoded_name}"


@router.get("/{file_id}")
def get_file(file_id: int, db: Session = Depends(get_db)):
    file = db.query(File).filter(File.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    headers = {"Cache-Control": "max-age=86400"}

    name = (getattr(file, "file_name", None) or getattr(file, "filename", None))
    if name:
        headers["Content-Disposition"] = content_disposition(name)

    return Response(
        content=bytes(file.file_content),
        media_type=file.mime_type,
        headers=headers,
    )