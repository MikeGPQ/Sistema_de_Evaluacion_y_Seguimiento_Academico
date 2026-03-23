import json
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import date, timedelta
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy import text

from app.db.database import get_db
from app.models.student import Student
from app.models.academic_program import AcademicProgram
from app.models.enrollment import StudentEnrollment
from app.models.attendance import AttendanceRecord
from app.models.academic_group import AcademicGroup
from app.models.subject import Subject
from app.models.academic_period import AcademicPeriod
from app.models.teacher import Teacher 
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/asistencia", tags=["Asistencia Docente"])

class CambioAsistencia(BaseModel):
    matricula: str
    fecha: date
    estado: str 
    notas_justificacion: Optional[str] = None 

class ObservacionAlumno(BaseModel):
    matricula: str
    observaciones: Optional[str] = None

class GuardarCambiosRequest(BaseModel):
    academic_group_id: int
    periodo_id: int
    cambios: List[CambioAsistencia]
    observaciones_alumnos: List[ObservacionAlumno] = []
    usuario_id: Optional[str] = "Sistema"

ESTADOS_DB = { "P": "asistencia", "F": "falta", "R": "retardo", "J": "justificado" }

def calcular_fechas_clase_v3(schedules, fecha_inicio: date, fecha_fin: date) -> List[str]:
    if not schedules or not fecha_inicio or not fecha_fin: return []
    
    dias_clase = [s.dia_semana - 1 for s in schedules] # Ajuste a 0-6 (Lunes-Domingo)
    
    fechas = []
    dia_actual = fecha_inicio
    while dia_actual <= fecha_fin:
        if dia_actual.weekday() in dias_clase:
            fechas.append(dia_actual.strftime("%Y-%m-%d"))
        dia_actual += timedelta(days=1)
    return fechas

@router.get("/periodos")
def obtener_periodos(db: Session = Depends(get_db)):
    periodos = db.query(AcademicPeriod).order_by(AcademicPeriod.id.desc()).all()
    return [{"id": p.id, "label": p.period_name, "is_active": p.is_active} for p in periodos]

@router.get("/mis-grupos")
def obtener_grupos_docente(periodo_id: int, num_empleado: str = "", teacher_id: int = None, db: Session = Depends(get_db)):
    if not teacher_id and num_empleado:
        res = db.query(Teacher.id).filter(Teacher.matricula_empleado == num_empleado).first()
        if res: teacher_id = res[0]

    if not teacher_id: return []

    grupos = db.query(AcademicGroup).join(Subject).join(AcademicProgram).filter(
        AcademicGroup.teacher_id == teacher_id,
        AcademicGroup.period_id == periodo_id
    ).all()

    return [{
        "id": g.id,
        "label": f"{g.subject.nombre} - {g.identificador_grupo}",
        "carrera": g.subject.career.name if g.subject.career else "Tronco Común"
    } for g in grupos]

@router.get("/grupo/{grupo_id}")
def obtener_alumnos_grupo(grupo_id: int, periodo_id: int, db: Session = Depends(get_db)):
    grupo = db.query(AcademicGroup).filter(AcademicGroup.id == grupo_id).first()
    if not grupo: raise HTTPException(status_code=404, detail="Grupo no encontrado")

    periodo = db.query(AcademicPeriod).filter(AcademicPeriod.id == periodo_id).first()
    fechas_clase = calcular_fechas_clase_v3(grupo.schedules, periodo.fecha_inicio, periodo.fecha_fin)
    
    inscripciones = db.query(StudentEnrollment).join(Student).filter(
        StudentEnrollment.academic_group_id == grupo_id
    ).all()

    alumnos_procesados = []
    for insc in inscripciones:
        asistencias_alumno = {}
        justificaciones_alumno = {}
        
        for rec in insc.attendance_records:
            fecha_str = rec.fecha_clase.strftime("%Y-%m-%d")
            inv_map = {v: k for k, v in ESTADOS_DB.items()}
            val = inv_map.get(rec.estado, "-")
            
            asistencias_alumno[fecha_str] = val
            if val == 'J' and rec.notas_justificacion:
                justificaciones_alumno[fecha_str] = rec.notas_justificacion
        
        alumnos_procesados.append({
            "id": insc.id,
            "matricula": insc.student_matricula,
            "nombre": f"{insc.student.nombre} {insc.student.apellido_paterno} {insc.student.apellido_materno}",
            "asistencias": asistencias_alumno,
            "justificaciones": justificaciones_alumno,
            "observaciones": insc.observaciones or ""
        })

    dias_nombres = {1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado", 7: "Domingo"}
    dias_str = ", ".join([dias_nombres.get(s.dia_semana, "") for s in grupo.schedules])

    return {
        "fechas": fechas_clase,
        "acta_cerrada": grupo.acta_status == 'cerrada',
        "periodo_activo": periodo.is_active,
        "dias_clase": dias_str,
        "alumnos": alumnos_procesados
    }

@router.post("/guardar")
def guardar_cambios_asistencia(datos: GuardarCambiosRequest, db: Session = Depends(get_db)):
    grupo = db.query(AcademicGroup).filter(AcademicGroup.id == datos.academic_group_id).first()
    periodo = db.query(AcademicPeriod).filter(AcademicPeriod.id == datos.periodo_id).first()

    if not grupo or grupo.acta_status == 'cerrada' or not periodo.is_active:
        raise HTTPException(status_code=403, detail="Modificación no permitida (Acta cerrada o periodo inactivo)")

    try:
        inscripciones = db.query(StudentEnrollment).filter(StudentEnrollment.academic_group_id == datos.academic_group_id).all()
        mapa_enrollments = {insc.student_matricula: insc.id for insc in inscripciones}
        cambios_cont = 0

        for cambio in datos.cambios:
            enroll_id = mapa_enrollments.get(cambio.matricula)
            if not enroll_id: continue
            
            estado_bd = ESTADOS_DB.get(cambio.estado, "asistencia")
            reg = db.query(AttendanceRecord).filter(
                AttendanceRecord.enrollment_id == enroll_id, 
                AttendanceRecord.fecha_clase == cambio.fecha
            ).first()

            if reg:
                if reg.estado != estado_bd or reg.notas_justificacion != cambio.notas_justificacion:
                    old_vals = {"estado": reg.estado, "notas": reg.notas_justificacion}
                    reg.estado = estado_bd
                    reg.notas_justificacion = cambio.notas_justificacion
                    log_audit_event(db, datos.usuario_id, "UPDATE", "attendance_records", str(reg.id), old_vals, {"estado": estado_bd, "notas": reg.notas_justificacion})
                    cambios_cont += 1
            else:
                nuevo = AttendanceRecord(enrollment_id=enroll_id, fecha_clase=cambio.fecha, estado=estado_bd, notas_justificacion=cambio.notas_justificacion)
                db.add(nuevo)
                db.flush()
                log_audit_event(db, datos.usuario_id, "CREATE", "attendance_records", str(nuevo.id), None, {"enroll_id": enroll_id, "estado": estado_bd})
                cambios_cont += 1

        for obs in datos.observaciones_alumnos:
            enroll_id = mapa_enrollments.get(obs.matricula)
            if enroll_id:
                insc = db.query(StudentEnrollment).filter(StudentEnrollment.id == enroll_id).first()
                if insc and insc.observaciones != obs.observaciones:
                    insc.observaciones = obs.observaciones
                    cambios_cont += 1
        
        db.commit()
        return {"message": "Éxito", "total_cambios": cambios_cont}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/student/subjects")
def get_student_attendance(student_id: str, period_id: int, db: Session = Depends(get_db)):
    inscripciones = db.query(StudentEnrollment).join(AcademicGroup).filter(
        StudentEnrollment.student_matricula == student_id,
        AcademicGroup.period_id == period_id
    ).all()

    periodo = db.query(AcademicPeriod).filter(AcademicPeriod.id == period_id).first()
    resultado = []

    for insc in inscripciones:
        grupo = insc.academic_group
        fechas = calcular_fechas_clase_v3(grupo.schedules, periodo.fecha_inicio, periodo.fecha_fin)
        
        att_map = {}
        just_map = {}
        for rec in insc.attendance_records:
            f_str = rec.fecha_clase.strftime("%Y-%m-%d")
            inv_map = {v: k for k, v in ESTADOS_DB.items()}
            val = inv_map.get(rec.estado, "-")
            att_map[f_str] = val
            if val == 'J': just_map[f_str] = rec.notas_justificacion

        resultado.append({
            "subjectName": grupo.subject.nombre,
            "groupCode": grupo.identificador_grupo,
            "teacherName": f"{grupo.teacher.nombre} {grupo.teacher.apellido_paterno}",
            "classDates": fechas,
            "attendanceData": att_map,
            "justifications": just_map
        })
    
    return resultado