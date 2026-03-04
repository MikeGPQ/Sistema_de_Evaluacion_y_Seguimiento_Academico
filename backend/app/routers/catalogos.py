from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.student_status import StudentStatus

router = APIRouter(prefix="/catalogos", tags=["Catálogos"])

@router.get("/estatus")
def get_estatus(db: Session = Depends(get_db)):
    estatus = db.query(StudentStatus).all()
    return [{"id": s.id, "name": s.name, "description": s.description} for s in estatus]
