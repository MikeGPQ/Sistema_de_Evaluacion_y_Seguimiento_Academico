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
from sqlalchemy import text
from fastapi import HTTPException

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
def obtener_grupos_docente(periodo: str, num_empleado: str = "", teacher_id: str = "", db: Session = Depends(get_db)):
    
    # 1. Resolvemos el ID del maestro si solo nos mandan el número de empleado
    if not teacher_id and num_empleado:
        res = db.execute(
            text("SELECT id FROM teachers WHERE external_id = :emp"), 
            {"emp": num_empleado}
        ).mappings().first()
        
        if res:
            teacher_id = res["id"]

    if not teacher_id:
        return []

    # 2. Usamos la vista v_teacher_groups del arquitecto
    # Hacemos un JOIN rápido con academic_groups solo para sacar el ID interno del grupo que necesita React
    query = text("""
        SELECT 
            g.id AS group_id, 
            v.crn AS identificador_grupo, 
            v.materia AS materia_nombre, 
            v.programa AS carrera_nombre 
        FROM v_teacher_groups v
        JOIN academic_groups g ON v.crn = g.identificador_grupo AND v.periodo = g.periodo
        WHERE v.id_docente = :teacher_id AND v.periodo = :periodo
    """)

    grupos = db.execute(query, {"teacher_id": teacher_id, "periodo": periodo}).mappings().all()

    # 3. Armamos la respuesta exacta que espera React
    respuesta = []
    for g in grupos:
        respuesta.append({
            "id": g["group_id"],
            "label": f"{g['materia_nombre']} - {g['identificador_grupo']}",
            "carrera": g["carrera_nombre"]
        })

    return respuesta




@router.get("/grupo/{grupo_id}")
def obtener_alumnos_grupo(grupo_id: int, periodo: str, db: Session = Depends(get_db)):
    
    # 1. Obtenemos la información base del grupo (para calcular las fechas y saber si ya se cerró el acta)
    query_grupo = text("""
        SELECT 
            g.identificador_grupo, 
            g.horario_json, 
            g.acta_status, 
            p.fecha_inicio, 
            p.fecha_fin, 
            p.is_active AS periodo_activo
        FROM academic_groups g
        JOIN academic_periods p ON g.periodo = p.period_name
        WHERE g.id = :grupo_id AND g.periodo = :periodo
    """)
    grupo_info = db.execute(query_grupo, {"grupo_id": grupo_id, "periodo": periodo}).mappings().first()
    
    if not grupo_info:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")

    # Calculamos los días exactos de clase
    fechas_clase = calcular_fechas_clase(grupo_info['horario_json'], grupo_info['fecha_inicio'], grupo_info['fecha_fin'])
    
    # 2. Usamos la vista 'v_group_roster' del arquitecto para obtener la lista oficial de alumnos inscritos
    query_alumnos = text("""
        SELECT 
            enrollment_id AS id, 
            matricula, 
            alumno AS nombre
        FROM v_group_roster
        WHERE crn = :crn AND periodo = :periodo
        ORDER BY alumno ASC
    """)
    alumnos_bd = db.execute(query_alumnos, {"crn": grupo_info['identificador_grupo'], "periodo": periodo}).mappings().all()

    # 3. Obtenemos todas las asistencias y observaciones de este grupo en un solo golpe (optimizado)
    enrollment_ids = [al['id'] for al in alumnos_bd]
    
    asistencias_totales = []
    observaciones_totales = []
    
    if enrollment_ids:
        # Extraemos asistencias
        query_asist = text(f"""
            SELECT enrollment_id, fecha_clase, estado, notas_justificacion 
            FROM attendance_records 
            WHERE enrollment_id IN ({','.join(map(str, enrollment_ids))})
        """)
        asistencias_totales = db.execute(query_asist).mappings().all()
        
        # Extraemos observaciones generales de los alumnos (si existen en student_enrollments)
        query_obs = text(f"""
            SELECT id AS enrollment_id, observaciones 
            FROM student_enrollments 
            WHERE id IN ({','.join(map(str, enrollment_ids))})
        """)
        observaciones_totales = db.execute(query_obs).mappings().all()

    # 4. Mapeamos los datos para que el Frontend los consuma fácilmente
    mapa_observaciones = {obs['enrollment_id']: obs['observaciones'] for obs in observaciones_totales}
    
    alumnos_procesados = []
    for al in alumnos_bd:
        asistencias_alumno = {}
        justificaciones_alumno = {}
        
        # Filtramos las asistencias solo de este alumno y traducimos el ENUM a letras
        registros_al = [r for r in asistencias_totales if r['enrollment_id'] == al['id']]
        for rec in registros_al:
            fecha_str = rec['fecha_clase'].strftime("%Y-%m-%d")
            db_estado = rec['estado']
            
            if db_estado == 'asistencia': val = 'P'
            elif db_estado == 'falta': val = 'F'
            elif db_estado == 'retardo': val = 'R'
            elif db_estado == 'justificado': val = 'J'
            else: val = '-'
            
            asistencias_alumno[fecha_str] = val
            
            if val == 'J' and rec['notas_justificacion']:
                justificaciones_alumno[fecha_str] = rec['notas_justificacion']
        
        alumnos_procesados.append({
            "id": al['id'],
            "matricula": al['matricula'],
            "nombre": al['nombre'],
            "asistencias": asistencias_alumno,
            "justificaciones": justificaciones_alumno,
            "observaciones": mapa_observaciones.get(al['id'], "")
        })

    # Extraemos un string bonito del horario para mostrarlo en React
    import json
    try:
        horario_list = json.loads(grupo_info['horario_json']) if isinstance(grupo_info['horario_json'], str) else grupo_info['horario_json']
        dias_clase_str = ", ".join([h.get('dia', '') for h in horario_list])
    except:
        dias_clase_str = "Horario no definido"

    return {
        "fechas": fechas_clase,
        "acta_cerrada": grupo_info['acta_status'] == 'cerrada',
        "periodo_activo": bool(grupo_info['periodo_activo']),
        "dias_clase": dias_clase_str,
        "alumnos": alumnos_procesados
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
                    registro_existente.estado = estado_bd
                    registro_existente.notas_justificacion = cambio.notas_justificacion
                    registros_actualizados += 1
            else:
                db.add(AttendanceRecord(enrollment_id=enroll_id, fecha_clase=cambio.fecha, estado=estado_bd, notas_justificacion=cambio.notas_justificacion))
                db.flush() 
                registros_actualizados += 1

        # 🌟 NUEVO: GUARDAR LAS NOTAS GENERALES
        if datos.observaciones_alumnos:
            for obs in datos.observaciones_alumnos:
                enroll_id = mapa_enrollments.get(obs.matricula)
                if enroll_id:
                    insc_record = db.query(StudentEnrollment).filter(StudentEnrollment.id == enroll_id).first()
                    # Solo actualizamos si la nota cambió
                    if insc_record and insc_record.observaciones != obs.observaciones:
                        insc_record.observaciones = obs.observaciones
                        registros_actualizados += 1
        
        db.commit()
        return {"message": "Cambios guardados", "total_cambios": registros_actualizados}
    except HTTPException: raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar: {str(e)}")



# ==========================================
# STUDENT EXCLUSIVE ROUTES (HU-16 & HU-17)
# ==========================================
from sqlalchemy import text

@router.get("/student/subjects")
def get_student_attendance(student_id: str, period: str, db: Session = Depends(get_db)):
    if not student_id or not period: 
        return []

    query_enrollments = text("""
        SELECT 
            v.enrollment_id,
            v.materia AS subject_name,
            v.crn AS group_code,
            v.docente AS teacher_name,
            v.alumno AS student_name,
            g.horario_json AS schedule_json,
            p.fecha_inicio AS start_date,
            p.fecha_fin AS end_date
        FROM v_enrollments_detail v
        JOIN academic_groups g ON v.crn = g.identificador_grupo AND g.periodo = v.periodo
        JOIN academic_periods p ON p.period_name = v.periodo
        WHERE v.matricula = :student_id AND v.periodo = :period
    """)
    
    enrollments_data = db.execute(query_enrollments, {"student_id": student_id, "period": period}).mappings().all()

    # 🌟 NUEVO: Usaremos un diccionario para agrupar y fusionar a los clones
    materias_fusionadas = {}

    for row in enrollments_data:
        class_dates = calcular_fechas_clase(row['schedule_json'], row['start_date'], row['end_date'])

        query_records = text("""
            SELECT fecha_clase, estado, notas_justificacion 
            FROM attendance_records 
            WHERE enrollment_id = :enrollment_id
        """)
        records_data = db.execute(query_records, {"enrollment_id": row['enrollment_id']}).mappings().all()

        attendance_map = {}
        justification_map = {}

        for rec in records_data:
            date_str = rec['fecha_clase'].strftime("%Y-%m-%d")
            db_status = rec['estado']
            
            if db_status == 'asistencia': val = 'P'
            elif db_status == 'falta': val = 'F'
            elif db_status == 'retardo': val = 'R'
            elif db_status == 'justificado': val = 'J'
            else: val = '-'

            attendance_map[date_str] = val
            if val == 'J' and rec['notas_justificacion']:
                justification_map[date_str] = rec['notas_justificacion']

        # 🌟 LA MAGIA DE LA FUSIÓN
        crn = row['group_code']
        if crn not in materias_fusionadas:
            # Es la primera vez que vemos esta materia, la registramos
            materias_fusionadas[crn] = {
                "subjectName": row['subject_name'],
                "groupCode": crn,
                "teacherName": row['teacher_name'],
                "studentName": row['student_name'],
                "classDates": class_dates,
                "attendanceData": attendance_map,
                "justifications": justification_map
            }
        else:
            # ¡Es un clon! Fusionamos sus asistencias con las que ya teníamos usando .update()
            materias_fusionadas[crn]["attendanceData"].update(attendance_map)
            materias_fusionadas[crn]["justifications"].update(justification_map)
    
    # Devolvemos solo los valores ya fusionados y limpios como una lista
    return list(materias_fusionadas.values())