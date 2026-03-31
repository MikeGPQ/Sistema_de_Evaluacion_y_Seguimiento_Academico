import json
import pandas as pd
from fastapi.responses import StreamingResponse
import io
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import date, timedelta
from typing import List, Optional
from pydantic import BaseModel

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
from app.models.student_academic_profile import StudentAcademicProfile;

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
    periodo: str = "2026-1"
    cambios: List[CambioAsistencia]
    observaciones_alumnos: List[ObservacionAlumno] = [] 
    usuario_id: Optional[str] = "Sistema"

ESTADOS_DB = { "P": "asistencia", "F": "falta", "R": "retardo", "J": "justificado" }

def calcular_fechas_clase_v3(schedules, fecha_inicio: date, fecha_fin: date) -> List[str]:
    if not schedules or not fecha_inicio or not fecha_fin: return []
    dias_clase = [s.dia_semana - 1 for s in schedules]
    
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
    return [{"id": p.codigo, "label": p.codigo, "is_active": p.is_active} for p in periodos]

@router.get("/mis-grupos")
def obtener_grupos_docente(periodo: str, num_empleado: str = "", teacher_id: str = "", db: Session = Depends(get_db)):
    teacher = None
    if num_empleado:
        teacher = db.query(Teacher).filter(Teacher.matricula_empleado == num_empleado).first()
    elif teacher_id and teacher_id.isdigit():
        teacher = db.query(Teacher).filter(Teacher.id == int(teacher_id)).first()

    if not teacher:
        return []

    period_obj = db.query(AcademicPeriod).filter(AcademicPeriod.codigo == periodo).first()
    if not period_obj:
        return []

    grupos = db.query(AcademicGroup).filter(
        AcademicGroup.teacher_id == teacher.id,
        AcademicGroup.period_id == period_obj.id
    ).all()

    respuesta = []
    for g in grupos:
        carrera_nombre = g.subject.career.name if g.subject and g.subject.career else "Tronco Común"
        materia_nombre = g.subject.nombre if g.subject else "Sin Materia"
        identificador = g.sigad_group.identificador if g.sigad_group else str(g.id)
        respuesta.append({
            "id": g.id,
            "label": f"{materia_nombre} - {identificador}",
            "carrera": carrera_nombre
        })

    return respuesta

@router.get("/grupo/{grupo_id}")
def obtener_alumnos_grupo(grupo_id: int, periodo: str, db: Session = Depends(get_db)):
    grupo = db.query(AcademicGroup).filter(AcademicGroup.id == grupo_id).first()
    if not grupo:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")

    period_obj = db.query(AcademicPeriod).filter(AcademicPeriod.codigo == periodo).first()
    if not period_obj:
        raise HTTPException(status_code=404, detail="Periodo no encontrado")

    fechas_clase = calcular_fechas_clase_v3(grupo.schedules, period_obj.fecha_inicio, period_obj.fecha_fin)
    
    inscripciones = db.query(StudentEnrollment).filter(StudentEnrollment.academic_group_id == grupo_id).all()

    alumnos_procesados = []
    for insc in inscripciones:
        student = insc.student
        nombre_completo = f"{student.apellido_paterno} {student.apellido_materno}, {student.nombre}".strip() if student else "Desconocido"
        
        asistencias_alumno = {}
        justificaciones_alumno = {}
        
        for rec in insc.attendance_records:
            fecha_str = rec.fecha_clase.strftime("%Y-%m-%d")
            db_estado = rec.estado
            
            if db_estado == 'asistencia': val = 'P'
            elif db_estado == 'falta': val = 'F'
            elif db_estado == 'retardo': val = 'R'
            elif db_estado == 'justificado': val = 'J'
            else: val = '-'
            
            asistencias_alumno[fecha_str] = val
            if val == 'J' and rec.notas_justificacion:
                justificaciones_alumno[fecha_str] = rec.notas_justificacion

        alumnos_procesados.append({
            "id": insc.id,
            "matricula": insc.student_matricula,
            "nombre": nombre_completo,
            "asistencias": asistencias_alumno,
            "justificaciones": justificaciones_alumno,
            "observaciones": insc.observaciones or ""
        })

    alumnos_procesados.sort(key=lambda x: x["nombre"])

    dias_map = {1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado", 7: "Domingo"}
    dias_clase_str = ", ".join([dias_map.get(s.dia_semana, "") for s in grupo.schedules]) if grupo.schedules else "Horario no definido"

    return {
        "fechas": fechas_clase,
        "acta_cerrada": grupo.estatus_acta == 'CERRADA',
        "periodo_activo": bool(period_obj.is_active),
        "dias_clase": dias_clase_str,
        "alumnos": alumnos_procesados
    }

@router.post("/guardar")
def guardar_cambios_asistencia(datos: GuardarCambiosRequest, request: Request, db: Session = Depends(get_db)):
    grupo = db.query(AcademicGroup).filter(AcademicGroup.id == datos.academic_group_id).first()
    if not grupo or grupo.estatus_acta == 'CERRADA':
        raise HTTPException(status_code=403, detail="El acta está cerrada. No se permiten modificaciones.")

    periodo_db = db.query(AcademicPeriod).filter(AcademicPeriod.codigo == datos.periodo).first()
    if periodo_db and not periodo_db.is_active:
        raise HTTPException(status_code=403, detail="Este periodo académico ya finalizó. No se permiten modificaciones.")

    for cambio in datos.cambios:
        if cambio.estado == 'J' and not cambio.notas_justificacion:
            raise HTTPException(status_code=400, detail=f"Falta el motivo de justificación para {cambio.matricula}")

    try:
        inscripciones = db.query(StudentEnrollment).filter(StudentEnrollment.academic_group_id == datos.academic_group_id).all()
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
                if registro_existente.estado != estado_bd or registro_existente.notas_justificacion != cambio.notas_justificacion:
                    registro_existente.estado = estado_bd
                    registro_existente.notas_justificacion = cambio.notas_justificacion
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
                registros_actualizados += 1

        if datos.observaciones_alumnos:
            for obs in datos.observaciones_alumnos:
                enroll_id = mapa_enrollments.get(obs.matricula)
                if enroll_id:
                    insc_record = db.query(StudentEnrollment).filter(StudentEnrollment.id == enroll_id).first()
                    if insc_record and insc_record.observaciones != obs.observaciones:
                        insc_record.observaciones = obs.observaciones
                        registros_actualizados += 1
        
        if registros_actualizados > 0:
            materia_nombre = grupo.subject.nombre if grupo.subject else "Sin Materia"
            identificador_grupo = grupo.sigad_group.identificador if grupo.sigad_group else str(grupo.id)

            nuevos_valores = {
                "evento": f"Actualización de asistencia u observaciones para {materia_nombre}",
                "Total de registros modificados": registros_actualizados
            }

            fechas_unicas = list(set([c.fecha.strftime("%d/%m/%Y") for c in datos.cambios]))
            if fechas_unicas:
                nuevos_valores["Fechas afectadas"] = ", ".join(fechas_unicas)

            if datos.observaciones_alumnos:
                nuevos_valores["Alumnos con nuevas observaciones"] = len(datos.observaciones_alumnos)

            log_audit_event(
                db=db,
                user_identifier=datos.usuario_id,
                action="UPDATE",
                entity_name="attendance_records",
                entity_id=identificador_grupo, 
                old_values=None,
                new_values=nuevos_valores
            )

        db.commit()
        return {"message": "Cambios guardados", "total_cambios": registros_actualizados}
    except HTTPException: raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar: {str(e)}")

@router.get("/student/subjects")
def get_student_attendance(student_id: str, period: str, db: Session = Depends(get_db)):
    if not student_id or not period: 
        return []

    period_obj = db.query(AcademicPeriod).filter(AcademicPeriod.codigo == period).first()
    if not period_obj:
        return []

    perfil = db.query(StudentAcademicProfile).filter(
        StudentAcademicProfile.student_matricula == student_id
    ).order_by(StudentAcademicProfile.id.desc()).first()
    
    carrera_alumno = perfil.career.name if perfil and getattr(perfil, 'career', None) else "Desconocida"

    inscripciones = db.query(StudentEnrollment).join(AcademicGroup).filter(
        StudentEnrollment.student_matricula == student_id,
        AcademicGroup.period_id == period_obj.id
    ).all()

    materias_fusionadas = {}

    for insc in inscripciones:
        grupo = insc.academic_group
        crn = grupo.sigad_group.identificador if grupo.sigad_group else str(grupo.id)
        class_dates = calcular_fechas_clase_v3(grupo.schedules, period_obj.fecha_inicio, period_obj.fecha_fin)

        attendance_map = {}
        justification_map = {}

        for rec in insc.attendance_records:
            date_str = rec.fecha_clase.strftime("%Y-%m-%d")
            db_status = rec.estado
            
            if db_status == 'asistencia': val = 'P'
            elif db_status == 'falta': val = 'F'
            elif db_status == 'retardo': val = 'R'
            elif db_status == 'justificado': val = 'J'
            else: val = '-'

            attendance_map[date_str] = val
            if val == 'J' and rec.notas_justificacion:
                justification_map[date_str] = rec.notas_justificacion

        if crn not in materias_fusionadas:
            docente_nombre = f"{grupo.teacher.nombre} {grupo.teacher.apellido_paterno}" if grupo.teacher else "Sin asignar"
            materia_nombre = grupo.subject.nombre if grupo.subject else "Sin Materia"
            alumno_nombre = f"{insc.student.nombre} {insc.student.apellido_paterno}" if insc.student else "Desconocido"
            
            materias_fusionadas[crn] = {
                "subjectName": materia_nombre,
                "groupCode": crn,
                "teacherName": docente_nombre,
                "studentName": alumno_nombre,
                "careerName": carrera_alumno, 
                "classDates": class_dates,
                "attendanceData": attendance_map,
                "justifications": justification_map
            }
        else:
            materias_fusionadas[crn]["attendanceData"].update(attendance_map)
            materias_fusionadas[crn]["justifications"].update(justification_map)
    
    return list(materias_fusionadas.values())

@router.get("/reporte")
def generar_reporte_asistencia(
    carrera_id: Optional[int] = None,
    cuatrimestre: Optional[int] = None,
    grupo_id: Optional[int] = None,
    materia_id: Optional[int] = None,
    formato: str = "excel",
    db: Session = Depends(get_db)
):
    # 🔹 Obtener periodo activo
    periodo = db.query(AcademicPeriod).filter(AcademicPeriod.is_active == True).first()
    if not periodo:
        raise HTTPException(status_code=404, detail="No hay periodo activo")

    # 🔹 Query base
    query = db.query(StudentEnrollment).join(AcademicGroup)

    if grupo_id:
        query = query.filter(StudentEnrollment.academic_group_id == grupo_id)

    if materia_id:
        query = query.join(Subject).filter(Subject.id == materia_id)

    if carrera_id:
        query = query.join(Subject).filter(Subject.career_id == carrera_id)

    if cuatrimestre:
        query = query.join(Subject).filter(Subject.quarter_id == cuatrimestre)

    inscripciones = query.all()

    data = []

    for insc in inscripciones:
        total_clases = 0
        asistencias = 0

        grupo = insc.academic_group
        fechas = calcular_fechas_clase_v3(
            grupo.schedules,
            periodo.fecha_inicio,
            periodo.fecha_fin
        )

        total_clases = len(fechas)

        for rec in insc.attendance_records:
            if rec.estado == "asistencia" or rec.estado == "justificado":
                asistencias += 1

        porcentaje = (asistencias / total_clases * 100) if total_clases > 0 else 0

        alumno = insc.student

        data.append({
            "matricula": alumno.matricula,
            "nombre": f"{alumno.nombre} {alumno.apellido_paterno}",
            "materia": grupo.subject.nombre if grupo.subject else "",
            "grupo": grupo.id,
            "asistencias": asistencias,
            "total_clases": total_clases,
            "porcentaje": round(porcentaje, 2),
            "riesgo": "SI" if porcentaje < 70 else "NO"
        })

    # 🔹 Convertir a DataFrame
    df = pd.DataFrame(data)

    if formato == "excel":
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Reporte")

        output.seek(0)

        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=reporte_asistencia.xlsx"}
        )

    return df.to_dict(orient="records")