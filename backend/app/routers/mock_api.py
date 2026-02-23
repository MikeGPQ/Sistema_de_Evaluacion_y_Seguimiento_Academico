from fastapi import APIRouter

router = APIRouter(
    prefix="/api-externa-mock",
    tags=["Mock API Externa (Temporal)"]
)

@router.get("/carga-academica")
def obtener_carga_academica_falsa():
    """
    Simula la respuesta del endpoint del equipo de Docentes.
    Una vez que ellos terminen, dejaremos de usar esta ruta.
    """
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
            "Cupo_Maximo": 40
        }
    ]