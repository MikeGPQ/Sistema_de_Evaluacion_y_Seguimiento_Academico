import json
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import date, timedelta
from typing import List, Optional
from pydantic import BaseModel

from app.db.database import get_db
from app.models.student import Student
from app.models.career import Career
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

# 🌟 MODELO PARA LAS NOTAS GENERALES
class ObservacionAlumno(BaseModel):
    matricula: str
    observaciones: Optional[str] = None

class GuardarCambiosRequest(BaseModel):
    academic_group_id: int
    periodo: str = "2026-1"
    cambios: List[CambioAsistencia]
    observaciones_alumnos: List[ObservacionAlumno] = [] # 🌟 RECIBIMOS LAS NOTAS
    usuario_id: Optional[str] = "Sistema"

ESTADOS_DB = { "P": "asistencia", "F": "falta", "R": "retardo", "J": "justificado" }
MAPA_DIAS = { "Lunes": 0, "Martes": 1, "Miércoles": 2, "Miercoles": 2, "Jueves": 3, "Viernes": 4, "Sábado": 5, "Sabado": 5, "Domingo": 6 }

def calcular_fechas_clase(horario_data, fecha_inicio: date, fecha_fin: date) -> List[str]:
    if not horario_data or not fecha_inicio or not fecha_fin: return []
    try:
        horarios = horario_data if isinstance(horario_data, list) else json.loads(horario_data)
        dias_clase = [MAPA_DIAS[h['dia']] for h in horarios if 'dia' in h and h['dia'] in MAPA_DIAS]
    except Exception:
        return []

    fechas = []
    dia_actual = fecha_inicio
    while dia_actual <= fecha_fin:
        if dia_actual.weekday() in dias_clase:
            fechas.append(dia_actual.strftime("%Y-%m-%d"))
        dia_actual += timedelta(days=1)
    return fechas

@router.get("/periodos")
def obtener_periodos(db: Session = Depends(get_db)):
    periodos = db.query(AcademicPeriod).order_by(AcademicPeriod.fecha_inicio.desc()).all()
    return [{"id": p.period_name, "label": p.period_name, "is_active": p.is_active} for p in periodos]

@router.get("/mis-grupos")
def obtener_grupos_docente(
    periodo: Optional[str] = None, 
    num_empleado: Optional[str] = None, 
    teacher_id: Optional[str] = None, 
    db: Session = Depends(get_db)
):
    if not periodo or (not num_empleado and not teacher_id):
        return []

    teacher_id_real = None
    
    if num_empleado and num_empleado.strip() != "":
        maestro = db.query(Teacher).filter(Teacher.external_id == num_empleado).first()
        if maestro:
            teacher_id_real = maestro.id
            
    elif teacher_id and teacher_id.strip() != "":
        try:
            teacher_id_real = int(teacher_id)
        except ValueError:
            pass

    if not teacher_id_real:
        return []

    grupos = db.query(AcademicGroup, Subject, Career).join(
        Subject, AcademicGroup.subject_id == Subject.id
    ).outerjoin(
        Career, Subject.career_id == Career.id
    ).filter(
        AcademicGroup.teacher_id == teacher_id_real, 
        AcademicGroup.periodo == periodo
    ).all()
    
    return [{
        "id": str(g.id), 
        "label": f"{m.external_id} - {m.nombre} ({g.identificador_grupo})",
        "carrera": c.name if c else "Tronco Común"
    } for g, m, c in grupos]

@router.get("/grupo/{group_id}")
def obtener_sabana_asistencia(group_id: int, periodo: str, db: Session = Depends(get_db)):
    grupo = db.query(AcademicGroup).filter(AcademicGroup.id == group_id).first()
    if not grupo: raise HTTPException(status_code=404, detail="Grupo no encontrado")
        
    materia = db.query(Subject).filter(Subject.id == grupo.subject_id).first()
    
    if materia and materia.career_id:
        carrera_oficial = db.query(Career).filter(Career.id == materia.career_id).first()
        nombre_carrera = carrera_oficial.name if carrera_oficial else "Tronco Común"
    else:
        nombre_carrera = "Tronco Común" 

    periodo_db = db.query(AcademicPeriod).filter(AcademicPeriod.period_name == grupo.periodo).first()
    fechas_dinamicas = calcular_fechas_clase(grupo.horario_json, periodo_db.fecha_inicio, periodo_db.fecha_fin) if periodo_db else []

    inscripciones = db.query(StudentEnrollment, Student, Career).join(Student, StudentEnrollment.student_matricula == Student.matricula).outerjoin(Career, Student.career_id == Career.id).filter(
        StudentEnrollment.academic_group_id == group_id, StudentEnrollment.period_name == periodo
    ).all()

    alumnos_resultado = []
    for insc, alumno, carrera in inscripciones:
        asistencias_db = db.query(AttendanceRecord).filter(AttendanceRecord.enrollment_id == insc.id).all()
        mapa_asistencias = {a.fecha_clase.strftime("%Y-%m-%d"): ("F" if a.estado == "falta" else "R" if a.estado == "retardo" else "J" if a.estado == "justificado" else "P") for a in asistencias_db}

        # 🌟 NUEVO: Extraemos los motivos de las justificaciones
        mapa_justificaciones = {a.fecha_clase.strftime("%Y-%m-%d"): a.notas_justificacion for a in asistencias_db if a.estado == "justificado" and a.notas_justificacion}

        alumnos_resultado.append({
            "id": insc.id, 
            "matricula": alumno.matricula,
            "nombre": f"{alumno.apellido_paterno} {alumno.apellido_materno}, {alumno.nombre}".upper(),
            "programa": carrera.name if carrera else "Sin Programa",
            "asistencias": mapa_asistencias,
            "justificaciones": mapa_justificaciones, # 🌟 Lo mandamos a React
            "observaciones": insc.observaciones or "" # 🌟 Cargamos la nota general
        })
    alumnos_resultado.sort(key=lambda x: x["nombre"])
    
    horario_str = "No definido"
    if grupo.horario_json:
        try:
            horarios = grupo.horario_json if isinstance(grupo.horario_json, list) else json.loads(grupo.horario_json)
            dias_con_hora = []
            for h in horarios:
                if 'dia' in h:
                    texto = h['dia']
                    if 'inicio' in h and 'fin' in h:
                        texto += f" ({h['inicio']} - {h['fin']})"
                    dias_con_hora.append(texto)
            if dias_con_hora: horario_str = " y ".join(dias_con_hora)
        except: pass

    return { 
        "acta_cerrada": grupo.acta_status == "cerrada", 
        "periodo_activo": periodo_db.is_active if periodo_db else False,
        "fechas": fechas_dinamicas, 
        "alumnos": alumnos_resultado,
        "periodo_nombre": periodo_db.period_name if periodo_db else periodo,
        "dias_clase": horario_str,
        "carrera_oficial": nombre_carrera 
    }

@router.post("/guardar")
def guardar_cambios_asistencia(datos: GuardarCambiosRequest, request: Request, db: Session = Depends(get_db)):
    grupo = db.query(AcademicGroup).filter(AcademicGroup.id == datos.academic_group_id).first()
    if not grupo or grupo.acta_status == 'cerrada':
        raise HTTPException(status_code=403, detail="El acta está cerrada. No se permiten modificaciones.")

    periodo_db = db.query(AcademicPeriod).filter(AcademicPeriod.period_name == datos.periodo).first()
    if periodo_db and not periodo_db.is_active:
        raise HTTPException(status_code=403, detail="Este periodo académico ya finalizó. No se permiten modificaciones.")

    for cambio in datos.cambios:
        if cambio.estado == 'J' and not cambio.notas_justificacion:
            raise HTTPException(status_code=400, detail=f"Falta el motivo de justificación para {cambio.matricula}")

    try:
        inscripciones = db.query(StudentEnrollment).filter(StudentEnrollment.academic_group_id == datos.academic_group_id, StudentEnrollment.period_name == datos.periodo).all()
        mapa_enrollments = {insc.student_matricula: insc.id for insc in inscripciones}
        registros_actualizados = 0

        # GUARDAR ASISTENCIAS
        for cambio in datos.cambios:
            enroll_id = mapa_enrollments.get(cambio.matricula)
            if not enroll_id: continue
            
            estado_bd = ESTADOS_DB.get(cambio.estado, "asistencia")
            registro_existente = db.query(AttendanceRecord).filter(AttendanceRecord.enrollment_id == enroll_id, AttendanceRecord.fecha_clase == cambio.fecha).first()

            if registro_existente:
                if registro_existente.estado != estado_bd or registro_existente.notas_justificacion != cambio.notas_justificacion:
                    old_vals = {
                        "estado": registro_existente.estado, 
                        "notas_justificacion": registro_existente.notas_justificacion
                    }
                    
                    registro_existente.estado = estado_bd
                    registro_existente.notas_justificacion = cambio.notas_justificacion

                    log_audit_event(
                        db=db,
                        user_identifier=datos.usuario_id,
                        action="UPDATE",
                        entity_name="attendance_records",
                        entity_id=str(registro_existente.id),
                        old_values=old_vals,
                        new_values={"estado": estado_bd, "notas_justificacion": cambio.notas_justificacion}
                    )

                    registros_actualizados += 1
            else:
                nuevo_registro = AttendanceRecord(
                    enrollment_id=enroll_id, 
                    fecha_clase=cambio.fecha, 
                    estado=estado_bd, 
                    notas_justificacion=cambio.notas_justificacion
                )
                db.add(nuevo_registro)
                db.flush() 
                
                log_audit_event(
                    db=db,
                    user_identifier=datos.usuario_id,
                    action="CREATE",
                    entity_name="attendance_records",
                    entity_id=str(nuevo_registro.id),
                    old_values=None,
                    new_values={
                        "enrollment_id": enroll_id,
                        "fecha_clase": str(cambio.fecha),
                        "estado": estado_bd,
                        "notas_justificacion": cambio.notas_justificacion
                    }
                )
                registros_actualizados += 1

        # 🌟 NUEVO: GUARDAR LAS NOTAS GENERALES
        if datos.observaciones_alumnos:
            for obs in datos.observaciones_alumnos:
                enroll_id = mapa_enrollments.get(obs.matricula)
                if enroll_id:
                    insc_record = db.query(StudentEnrollment).filter(StudentEnrollment.id == enroll_id).first()
                    # Solo actualizamos si la nota cambió
                    if insc_record and insc_record.observaciones != obs.observaciones:
                        old_obs = {"observaciones": insc_record.observaciones}
                        insc_record.observaciones = obs.observaciones
                        
                        log_audit_event(
                            db=db,
                            user_identifier=datos.usuario_id,
                            action="UPDATE",
                            entity_name="student_enrollments",
                            entity_id=str(insc_record.id),
                            old_values=old_obs,
                            new_values={"observaciones": obs.observaciones}
                        )
                        registros_actualizados += 1
        
        db.commit()
        return {"message": "Cambios guardados", "total_cambios": registros_actualizados}
    except HTTPException: raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar: {str(e)}")