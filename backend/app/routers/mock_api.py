from fastapi import FastAPI, APIRouter

app = FastAPI(title="Servidor Mock de la API Externa")

router = APIRouter(
    prefix="/api-externa-mock",
    tags=["Mock API Externa (Temporal)"]
)

@router.get("/carga-academica")
def obtener_carga_academica_falsa():
    return [
        {
            "ID_Materia": "10001",
            "Nombre_Materia": "Lógica de Programación",
            "Cuatrimestre": 1,
            "Creditos": 8,
            "ID_Carrera": 9,
            "ID_Docente": "90000000",
            "Nombre_Docente": "Roberto",
            "Apellido_Paterno": "Gómez",
            "Apellido_Materno": "Bolaños",
            "Email_Personal": "roberto.g@gmail.com",
            "Email_Institucional": "roberto.gomez@unid.edu.mx",
            "Periodo": "2026-1",
            "Identificador_Grupo": "1A",
            "Horarios": [
                {"dia": "Lunes", "inicio": "07:00", "fin": "09:00"}, 
                {"dia": "Miércoles", "inicio": "07:00", "fin": "09:00"}
            ],
            "Cupo_Maximo": 30
        },
        {
            "ID_Materia": "10004",
            "Nombre_Materia": "Bases de Datos Relacionales",
            "Cuatrimestre": 4,
            "Creditos": 8,
            "ID_Carrera": 9,
            "ID_Docente": "90000003",
            "Nombre_Docente": "Florinda",
            "Apellido_Paterno": "Meza",
            "Apellido_Materno": "García",
            "Email_Personal": "florinda.m@gmail.com",
            "Email_Institucional": "florinda.meza@unid.edu.mx",
            "Periodo": "2026-1",
            "Identificador_Grupo": "4A",
            "Horarios": [
                {"dia": "Lunes", "inicio": "18:00", "fin": "20:00"}, 
                {"dia": "Miércoles", "inicio": "18:00", "fin": "20:00"}
            ],
            "Cupo_Maximo": 25
        },
        {
            "ID_Materia": "10007",
            "Nombre_Materia": "Arquitectura de Software",
            "Cuatrimestre": 8,
            "Creditos": 9,
            "ID_Carrera": 9,
            "ID_Docente": "90000000",
            "Nombre_Docente": "Roberto",
            "Apellido_Paterno": "Gómez",
            "Apellido_Materno": "Bolaños",
            "Email_Personal": "roberto.g@gmail.com",
            "Email_Institucional": "roberto.gomez@unid.edu.mx",
            "Periodo": "2026-1",
            "Identificador_Grupo": "8A",
            "Horarios": [
                {"dia": "Lunes", "inicio": "11:00", "fin": "13:00"}, 
                {"dia": "Viernes", "inicio": "11:00", "fin": "13:00"}
            ],
            "Cupo_Maximo": 20
        },
        {
            "ID_Materia": "10007",
            "Nombre_Materia": "Arquitectura de Software",
            "Cuatrimestre": 8,
            "Creditos": 9,
            "ID_Carrera": 9,
            "ID_Docente": "90000001",
            "Nombre_Docente": "María",
            "Apellido_Paterno": "Antonieta",
            "Apellido_Materno": "De las Nieves",
            "Email_Personal": "maria.a@hotmail.com",
            "Email_Institucional": "maria.nieves@unid.edu.mx",
            "Periodo": "2026-1",
            "Identificador_Grupo": "8B",
            "Horarios": [
                {"dia": "Lunes", "inicio": "18:00", "fin": "20:00"},
                {"dia": "Miércoles", "inicio": "18:00", "fin": "20:00"}
            ],
            "Cupo_Maximo": 20
        },
        {
            "ID_Materia": "10008",
            "Nombre_Materia": "Inteligencia Artificial",
            "Cuatrimestre": 8,
            "Creditos": 8,
            "ID_Carrera": 9,
            "ID_Docente": "90000002",
            "Nombre_Docente": "Ramón",
            "Apellido_Paterno": "Valdés",
            "Apellido_Materno": "Castillo",
            "Email_Personal": "ramon.v@yahoo.com",
            "Email_Institucional": "ramon.valdes@unid.edu.mx",
            "Periodo": "2026-1",
            "Identificador_Grupo": "8A",
            "Horarios": [
                {"dia": "Miércoles", "inicio": "16:00", "fin": "19:00"}
            ],
            "Cupo_Maximo": 20
        },
        {
            "ID_Materia": "10008",
            "Nombre_Materia": "Inteligencia Artificial",
            "Cuatrimestre": 8,
            "Creditos": 8,
            "ID_Carrera": 9,
            "ID_Docente": "90000003",
            "Nombre_Docente": "Florinda",
            "Apellido_Paterno": "Meza",
            "Apellido_Materno": "García",
            "Email_Personal": "florinda.m@gmail.com",
            "Email_Institucional": "florinda.meza@unid.edu.mx",
            "Periodo": "2026-1",
            "Identificador_Grupo": "8B",
            "Horarios": [
                {"dia": "Lunes", "inicio": "18:00", "fin": "20:00"},
                {"dia": "Miércoles", "inicio": "18:00", "fin": "20:00"}
            ],
            "Cupo_Maximo": 20
        },
        {
            "ID_Materia": "10009",
            "Nombre_Materia": "Gestión de Proyectos de Software",
            "Cuatrimestre": 8,
            "Creditos": 8,
            "ID_Carrera": 9,
            "ID_Docente": "90000004",
            "Nombre_Docente": "Carlos",
            "Apellido_Paterno": "Villagrán",
            "Apellido_Materno": "Eslava",
            "Email_Personal": "carlos.v@outlook.com",
            "Email_Institucional": "carlos.villagran@unid.edu.mx",
            "Periodo": "2026-1",
            "Identificador_Grupo": "8A",
            "Horarios": [
                {"dia": "Martes", "inicio": "16:00", "fin": "18:00"},
                {"dia": "Jueves", "inicio": "16:00", "fin": "18:00"}
            ],
            "Cupo_Maximo": 25
        },
        {
            "ID_Materia": "10009",
            "Nombre_Materia": "Gestión de Proyectos de Software",
            "Cuatrimestre": 8,
            "Creditos": 8,
            "ID_Carrera": 9,
            "ID_Docente": "90000005",
            "Nombre_Docente": "Angelines",
            "Apellido_Paterno": "Fernández",
            "Apellido_Materno": "Abad",
            "Email_Personal": "angelines.f@gmail.com",
            "Email_Institucional": "angelines.fernandez@unid.edu.mx",
            "Periodo": "2026-1",
            "Identificador_Grupo": "8B",
            "Horarios": [
                {"dia": "Viernes", "inicio": "10:00", "fin": "13:00"}
            ],
            "Cupo_Maximo": 25
        },
        {
            "ID_Materia": "10010",
            "Nombre_Materia": "Desarrollo de Aplicaciones Móviles",
            "Cuatrimestre": 8,
            "Creditos": 8,
            "ID_Carrera": 9,
            "ID_Docente": "90000006",
            "Nombre_Docente": "Edgar",
            "Apellido_Paterno": "Vivar",
            "Apellido_Materno": "Villanueva",
            "Email_Personal": "edgar.v@hotmail.com",
            "Email_Institucional": "edgar.vivar@unid.edu.mx",
            "Periodo": "2026-1",
            "Identificador_Grupo": "8A",
            "Horarios": [
                {"dia": "Lunes", "inicio": "07:00", "fin": "09:00"},
                {"dia": "Miércoles", "inicio": "07:00", "fin": "09:00"}
            ],
            "Cupo_Maximo": 20
        },
        {
            "ID_Materia": "10010",
            "Nombre_Materia": "Desarrollo de Aplicaciones Móviles",
            "Cuatrimestre": 8,
            "Creditos": 8,
            "ID_Carrera": 9,
            "ID_Docente": "90000007",
            "Nombre_Docente": "Horacio",
            "Apellido_Paterno": "Gómez",
            "Apellido_Materno": "Bolaños",
            "Email_Personal": "horacio.g@gmail.com",
            "Email_Institucional": "horacio.gomez@unid.edu.mx",
            "Periodo": "2026-1",
            "Identificador_Grupo": "8B",
            "Horarios": [
                {"dia": "Miércoles", "inicio": "17:00", "fin": "20:00"}
            ],
            "Cupo_Maximo": 20
        },
        {
            "ID_Materia": "10011",
            "Nombre_Materia": "Sistemas Distribuidos",
            "Cuatrimestre": 8,
            "Creditos": 7,
            "ID_Carrera": 9,
            "ID_Docente": "90000008",
            "Nombre_Docente": "Rubén",
            "Apellido_Paterno": "Aguirre",
            "Apellido_Materno": "Fuentes",
            "Email_Personal": "ruben.a@yahoo.com",
            "Email_Institucional": "ruben.aguirre@unid.edu.mx",
            "Periodo": "2026-1",
            "Identificador_Grupo": "8A",
            "Horarios": [
                {"dia": "Jueves", "inicio": "18:00", "fin": "20:00"},
                {"dia": "Viernes", "inicio": "18:00", "fin": "20:00"}
            ],
            "Cupo_Maximo": 30
        },
        {
            "ID_Materia": "20001",
            "Nombre_Materia": "Introducción al Estudio del Derecho",
            "Cuatrimestre": 1,
            "Creditos": 7,
            "ID_Carrera": 2,
            "ID_Docente": "90000009",
            "Nombre_Docente": "Ana",
            "Apellido_Paterno": "Lilian",
            "Apellido_Materno": "De la Macorra",
            "Email_Personal": "ana.lilian@gmail.com",
            "Email_Institucional": "ana.macorra@unid.edu.mx",
            "Periodo": "2026-1",
            "Identificador_Grupo": "1B",
            "Horarios": [
                {"dia": "Lunes", "inicio": "08:00", "fin": "10:00"}, 
                {"dia": "Jueves", "inicio": "08:00", "fin": "10:00"}
            ],
            "Cupo_Maximo": 40
        }
    ]

app.include_router(router)