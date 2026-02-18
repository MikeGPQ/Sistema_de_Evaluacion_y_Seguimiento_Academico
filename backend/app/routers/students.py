from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.student import Student
from app.models.student_addresses import StudentAddress
from app.models.career import Career
from app.models.origin_school import OriginSchool
from app.models.user import User 
from passlib.context import CryptContext 
import pandas as pd
import io

pwd_context = CryptContext(
    schemes=["bcrypt"], 
    deprecated="auto", 
    bcrypt__ident="2b" 
)

router = APIRouter(prefix="/alumnos", tags=["Alumnos"])

@router.post("/importar")
async def importar_alumnos(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.xlsx'):
        raise HTTPException(status_code=400, detail="Error: Solo se permiten archivos .xlsx")

    content = await file.read()
    df = pd.read_excel(io.BytesIO(content))
    df.columns = [c.replace(':', '').strip() for c in df.columns]

    registros_nuevos = 0
    credenciales_generadas = []

    for _, row in df.iterrows():
        matricula_str = str(row.get('Matrícula', '')).strip()
        if not matricula_str or matricula_str == 'nan': continue

        # CAMBIO AQUÍ: En lugar de saltar, lanzamos error si ya existe
        if db.query(Student).filter(Student.matricula == matricula_str).first():
            raise HTTPException(
                status_code=400, 
                detail=f"La matrícula {matricula_str} ya está registrada en el sistema."
            )

        try:
            carrera_excel = str(row.get('Carrera', '')).strip()
            career = db.query(Career).filter(
                (Career.external_id == carrera_excel) | (Career.name == carrera_excel)
            ).first()
            
            escuela_excel = str(row.get('Procedencia', '')).strip()
            school = db.query(OriginSchool).filter(OriginSchool.name == escuela_excel).first()

            if not career or not school:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Datos maestros (Carrera/Escuela) no encontrados para matrícula {matricula_str}"
                )

            email_inst = row.get('Correo Institucional') or row.get('Correo institucional')

            nuevo_alumno = Student(
                matricula=matricula_str,
                nombre=row.get('Nombre'),
                apellido_paterno=row.get('Apellido Paterno'), 
                apellido_materno=row.get('Apellido Materno'),
                curp=row.get('Curp'),
                email_personal=row.get('Correo Personal') or row.get('Correo personal'),
                email_institucional=email_inst,
                cuatrimestre_actual=int(row.get('Cuatrimestre') or 1),
                status=row.get('Estatus', 'activo').lower(), 
                career_id=career.id,
                origin_school_id=school.id,
                promedio_procedencia=float(row.get('Promedio General', 0))
            )
            db.add(nuevo_alumno)

            if email_inst:
                password_plana = str(matricula_str).strip()
                nuevo_usuario = User(
                    identifier=matricula_str,
                    email=email_inst,
                    password_hash=pwd_context.hash(password_plana),
                    role='alumno',
                    is_temp_password=True
                )
                db.add(nuevo_usuario)
                
                credenciales_generadas.append({
                    "nombre": f"{row.get('Nombre')} {row.get('Apellido Paterno')}",
                    "usuario": matricula_str,
                    "password": password_plana,
                    "correo": email_inst
                })

            nueva_direccion = StudentAddress(
                student_matricula=matricula_str,
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

        except HTTPException as he:
            db.rollback()
            raise he
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

    return {
        "message": f"{registros_nuevos} alumnos y usuarios creados correctamente.",
        "data": credenciales_generadas 
    }