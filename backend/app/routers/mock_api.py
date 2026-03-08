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
            "ID_Materia": "EXT-MAT-101",
            "Nombre_Materia": "Desarrollo de Aplicaciones",
            "Cuatrimestre": 8,
            "Creditos": 8,
            "ID_Carrera": 9,
            "ID_Docente": "EXT-DOC-001",
            "Nombre_Docente": "Sergio Antonio",
            "Apellido_Paterno": "Panti",
            "Apellido_Materno": "Salvador",
            "Periodo": "2026-1",
            "Identificador_Grupo": "8vo A",
            "Horarios": [
                {"dia": "Lunes", "inicio": "18:00", "fin": "20:00"}, 
                {"dia": "Miércoles", "inicio": "18:00", "fin": "20:00"}
            ],
            "Cupo_Maximo": 25
        },
        {
            "ID_Materia": "EXT-MAT-102",
            "Nombre_Materia": "Responsabilidad Social",
            "Cuatrimestre": 8,
            "Creditos": 8,
            "ID_Carrera": 9,
            "ID_Docente": "EXT-DOC-003",
            "Nombre_Docente": "Aldo Roberto",
            "Apellido_Paterno": "Echeverria",
            "Apellido_Materno": "Carrera",
            "Periodo": "2026-1",
            "Identificador_Grupo": "103_adv",
            "Horarios": [
                {"dia": "Lunes", "inicio": "17:00", "fin": "20:00"}, 
                {"dia": "Miércoles", "inicio": "17:00", "fin": "20:00"}
            ],
            "Cupo_Maximo": 10
        },
        {
            "ID_Materia": "EXT-MAT-110",
            "Nombre_Materia": "ADMINISTRACION DE PROYECTOS",
            "Cuatrimestre": 8,
            "Creditos": 8,
            "ID_Carrera": 9,
            "ID_Docente": "EXT-DOC-008",
            "Nombre_Docente": "Mauricio Noe",
            "Apellido_Paterno": "Valladares",
            "Apellido_Materno": "Velueta",
            "Periodo": "2026-1",
            "Identificador_Grupo": "110_adv",
            "Horarios": [
                {"dia": "Lunes", "inicio": "13:00", "fin": "15:00"}, 
                {"dia": "Miércoles", "inicio": "13:00", "fin": "15:00"}
            ],
            "Cupo_Maximo": 10
        },
        {
            "ID_Materia": "EXT-MAT-103",
            "Nombre_Materia": "Derecho Corporativo",
            "Cuatrimestre": 5,
            "Creditos": 6,
            "ID_Carrera": 2,
            "ID_Docente": "EXT-DOC-002",
            "Nombre_Docente": "María Teresa",
            "Apellido_Paterno": "Gómez",
            "Apellido_Materno": "López",
            "Periodo": "2026-1",
            "Identificador_Grupo": "5to B",
            "Horarios": [
                {"dia": "Lunes", "inicio": "08:00", "fin": "10:00"}, 
                {"dia": "Viernes", "inicio": "08:00", "fin": "10:00"}
            ],
            "Cupo_Maximo": 10
        }
    ]


app.include_router(router)