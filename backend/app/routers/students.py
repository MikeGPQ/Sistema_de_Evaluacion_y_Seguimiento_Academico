from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.database import get_db
from app.models.student import Student
from app.models.student_addresses import StudentAddress
from app.models.career import Career
from app.models.origin_school import OriginSchool
import pandas as pd
import io

router = APIRouter(prefix="/alumnos", tags=["Alumnos"])

@router.post("/importar")
async def importar_alumnos(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.xlsx'):
        raise HTTPException(status_code=400, detail="Error: Solo se permiten archivos .xlsx")

    content = await file.read()
    
   
    df = pd.read_excel(io.BytesIO(content))
    
    
    df.columns = [c.replace(':', '').strip() for c in df.columns]

    registros_nuevos = 0

    for _, row in df.iterrows():
        matricula_str = str(row.get('Matrícula', '')).strip()
        if not matricula_str or matricula_str == 'nan': continue

       
        existente = db.query(Student).filter(Student.matricula == matricula_str).first()
        if existente: continue 

        try:
            
            carrera_excel = str(row.get('Carrera', '')).strip()
           
            career = db.query(Career).filter(
                (Career.external_id == carrera_excel) | (Career.name == carrera_excel)
            ).first()

            if not career:
                print(f"⚠️ Carrera '{carrera_excel}' no encontrada en BD. Saltando...")
                continue

            
            escuela_excel = str(row.get('Procedencia', '')).strip()
            school = db.query(OriginSchool).filter(OriginSchool.name == escuela_excel).first()

            if not school:
                print(f"⚠️ Escuela '{escuela_excel}' no existe en la lista oficial.")
                continue

            
            nuevo_alumno = Student(
                matricula=matricula_str,
                nombre=row.get('Nombre'),
                apellido_paterno=row.get('Apellido Paterno'), 
                apellido_materno=row.get('Apellido Materno'),
                curp=row.get('Curp'),
                email_personal=row.get('Correo Personal') or row.get('Correo personal'),
                email_institucional=row.get('Correo Institucional') or row.get('Correo institucional'),
                
                
                cuatrimestre_actual=int(row.get('Cuatrimestre') or 1),
                
                status=row.get('Estatus', 'activo').lower(), 
                career_id=career.id,
                origin_school_id=school.id,
                promedio_procedencia=float(row.get('Promedio General', 0))
            )
            db.add(nuevo_alumno)
            db.flush()

            nueva_direccion = StudentAddress(
                student_matricula=nuevo_alumno.matricula,
                calle=row.get('Calle'),
                numero_domicilio=str(row.get('Número de domicilio') or 'S/N'), 
                colonia=row.get('Colonia'),
                codigo_postal=str(row.get('Código Postal') or row.get('Código postal')),
                municipio=row.get('Municipio'),
                estado=row.get('Estado', 'Campeche')
            )
            db.add(nueva_direccion)
            
            db.commit()
            registros_nuevos += 1

        except Exception as e:
            db.rollback()
            print(f"❌ Error en matrícula {matricula_str}: {e}")

    return {"message": f"{registros_nuevos} alumnos importados correctamente."}