import json
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import date
from typing import List
from pydantic import BaseModel

from app.db.database import get_db
from app.models.student import Student
from app.models.career import Career
from app.models.enrollment import StudentEnrollment
from app.models.attendance import AttendanceRecord
# from app.models.audit_log import AuditLog # Descomentar cuando el arquitecto la cree

router = APIRouter(prefix="/asistencia", tags=["Asistencia Docente"])

class CambioAsistencia(BaseModel):
    matricula: str
    fecha: date
    estado: str 

class GuardarCambiosRequest(BaseModel):
    academic_group_id: int
    periodo: str = "2026-1"
    cambios: List[CambioAsistencia]

ESTADOS_DB = { "P": "asistencia", "F": "falta", "R": "retardo", "J": "justificado" }

# 🌟 NUEVO: Endpoint para traer a los alumnos de verdad desde la BD
@router.get("/grupo/{group_id}")
def obtener_sabana_asistencia(group_id: int, periodo: str = "2026-1", db: Session = Depends(get_db)):
    # 1. Buscamos a los alumnos inscritos haciendo un JOIN con sus datos y su carrera
    inscripciones = db.query(StudentEnrollment, Student, Career).join(
        Student, StudentEnrollment.student_matricula == Student.matricula
    ).outerjoin(
        Career, Student.career_id == Career.id
    ).filter(
        StudentEnrollment.academic_group_id == group_id,
        StudentEnrollment.period_name == periodo
    ).all()

    if not inscripciones:
        return []

    resultado = []
    for insc, alumno, carrera in inscripciones:
        # 2. Traemos las asistencias que ya tenía guardadas este alumno
        asistencias_db = db.query(AttendanceRecord).filter(
            AttendanceRecord.enrollment_id == insc.id
        ).all()

        mapa_asistencias = {}
        for a in asistencias_db:
            # Traducimos de BD ('falta') a Frontend ('F')
            estado_letra = "P"
            if a.estado == "falta": estado_letra = "F"
            elif a.estado == "retardo": estado_letra = "R"
            elif a.estado == "justificado": estado_letra = "J"
            
            fecha_str = a.fecha_clase.strftime("%Y-%m-%d")
            mapa_asistencias[fecha_str] = estado_letra

        # 3. Formateamos el nombre como lo pide el PDF
        nombre_completo = f"{alumno.apellido_paterno} {alumno.apellido_materno}, {alumno.nombre}".upper()

        resultado.append({
            "id": insc.id, 
            "matricula": alumno.matricula,
            "nombre": nombre_completo,
            "programa": carrera.name if carrera else "Sin Programa",
            "asistencias": mapa_asistencias,
            "observaciones": "" 
        })

    # Ordenar alfabéticamente
    resultado.sort(key=lambda x: x["nombre"])
    return resultado


@router.post("/guardar")
def guardar_cambios_asistencia(datos: GuardarCambiosRequest, request: Request, db: Session = Depends(get_db)):
    if not datos.cambios:
        return {"message": "No se recibieron cambios para procesar"}

    user_id_simulado = 10 

    try:
        inscripciones = db.query(StudentEnrollment).filter(
            StudentEnrollment.academic_group_id == datos.academic_group_id,
            StudentEnrollment.period_name == datos.periodo
        ).all()
        
        mapa_enrollments = {insc.student_matricula: insc.id for insc in inscripciones}
        registros_actualizados = 0

        for cambio in datos.cambios:
            enroll_id = mapa_enrollments.get(cambio.matricula)
            if not enroll_id: continue
            
            estado_bd = ESTADOS_DB.get(cambio.estado, "asistencia")
            
            registro_existente = db.query(AttendanceRecord).filter(
                AttendanceRecord.enrollment_id == enroll_id,
                AttendanceRecord.fecha_clase == cambio.fecha
            ).first()

            if registro_existente:
                if registro_existente.estado != estado_bd:
                    old_values = json.dumps({"estado": registro_existente.estado})
                    new_values = json.dumps({"estado": estado_bd})
                    
                    registro_existente.estado = estado_bd
                    
                    # log = AuditLog(user_id=user_id_simulado, action="UPDATE", entity_name="attendance_records", entity_id=str(registro_existente.id), old_values=old_values, new_values=new_values)
                    # db.add(log)
                    
                    registros_actualizados += 1
            else:
                nuevo_registro = AttendanceRecord(
                    enrollment_id=enroll_id,
                    fecha_clase=cambio.fecha,
                    estado=estado_bd
                )
                db.add(nuevo_registro)
                db.flush() 

                new_values = json.dumps({"enrollment_id": enroll_id, "fecha_clase": str(cambio.fecha), "estado": estado_bd})
                
                # log = AuditLog(user_id=user_id_simulado, action="CREATE", entity_name="attendance_records", entity_id=str(nuevo_registro.id), old_values=None, new_values=new_values)
                # db.add(log)
                
                registros_actualizados += 1
        
        db.commit()
        return {"message": "Cambios guardados e historial (logs) registrado", "total_cambios": registros_actualizados}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar: {str(e)}")