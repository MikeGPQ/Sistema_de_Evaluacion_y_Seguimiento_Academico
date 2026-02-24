from fastapi import APIRouter
from sqlalchemy.orm import Session
import requests
from app.db.database import SessionLocal 
from app.models.teacher import Teacher
from app.models.subject import Subject
from app.models.academic_group import AcademicGroup

router = APIRouter(
    prefix="/sincronizacion",
    tags=["Sincronización Automática"]
)

URL_API_DOCENTES = "http://127.0.0.1:8000/api-externa-mock/carga-academica"

def tarea_automatica_sincronizacion():
    db = SessionLocal()
    try:
        respuesta = requests.get(URL_API_DOCENTES)
        if respuesta.status_code != 200:
            print("❌ Error: API de Docentes no disponible")
            return

        datos = respuesta.json()
        registros_procesados = 0

        for item in datos:
            docente = db.query(Teacher).filter(Teacher.external_id == item["ID_Docente"]).first()
            if not docente:
                docente = Teacher(
                    external_id=item["ID_Docente"], nombre=item["Nombre_Docente"],
                    apellido_paterno=item["Apellido_Paterno"], apellido_materno=item["Apellido_Materno"]
                )
                db.add(docente)
                db.commit()
                db.refresh(docente)

            materia = db.query(Subject).filter(Subject.external_id == item["ID_Materia"]).first()
            if not materia:
                materia = Subject(
                    external_id=item["ID_Materia"], nombre=item["Nombre_Materia"],
                    cuatrimestre=item["Cuatrimestre"], creditos=item["Creditos"], career_id=item["ID_Carrera"]
                )
                db.add(materia)
                db.commit()
                db.refresh(materia)

            grupo = db.query(AcademicGroup).filter(
                AcademicGroup.periodo == item["Periodo"],
                AcademicGroup.identificador_grupo == item["Identificador_Grupo"],
                AcademicGroup.subject_id == materia.id,
                AcademicGroup.teacher_id == docente.id
            ).first()

            if not grupo:
                grupo = AcademicGroup(
                    subject_id=materia.id, teacher_id=docente.id, periodo=item["Periodo"],
                    identificador_grupo=item["Identificador_Grupo"], horario_json=item["Horarios"],
                    cupo_maximo=item["Cupo_Maximo"]
                )
                db.add(grupo)
            else:
                grupo.horario_json = item["Horarios"]
                grupo.cupo_maximo = item["Cupo_Maximo"]

            db.commit()
            registros_procesados += 1

        print(f"✅ Sincronización Automática Exitosa: {registros_procesados} registros procesados.")
    except Exception as e:
        print(f"❌ Error en Sincronización Automática: {e}")
    finally:
        db.close()

@router.post("/ejecutar")
def sincronizar_datos_manual():
    tarea_automatica_sincronizacion()
    return {"mensaje": "Sincronización manual disparada con éxito. Revisa la consola."}