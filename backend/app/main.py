import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from sqlalchemy import text
from apscheduler.schedulers.background import BackgroundScheduler

from app.db.database import engine
from app.routers.students import router as students_router
from app.routers import Listados
from app.routers import auth
from app.routers import mock_api
from app.routers import sync
from app.routers import enrollments
from app.routers import catalogos
from app.routers import administradores
from app.routers.sync import tarea_automatica_sincronizacion
from app.routers import enrollments

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = BackgroundScheduler()
    scheduler.add_job(tarea_automatica_sincronizacion, 'interval', minutes=1)
    scheduler.start()
    print("Cronjob de Sincronización Iniciado (Corriendo cada 1 minuto)")

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        print("\n¡CONEXIÓN A BASE DE DATOS EXITOSA!\n")
    except Exception as e:
        print(f"\nERROR AL CONECTAR A LA BD: {e}\n")

    yield

    scheduler.shutdown()
    print("Cronjob de Sincronización Detenido")

app = FastAPI(
    title="SESA API",
    version="1.0.0",
    lifespan=lifespan
)

origins_env = os.getenv("BACKEND_CORS_ORIGINS", "")
origins = [o.strip() for o in origins_env.split(",") if o.strip()]

if not origins:
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ]

print("CORS ORIGINS ACTIVOS:", origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(students_router)
app.include_router(Listados.router)
app.include_router(auth.router)
app.include_router(mock_api.router)
app.include_router(sync.router)
app.include_router(catalogos.router)
app.include_router(administradores.router)
app.include_router(enrollments.router)

@app.get("/")
def read_root():
    return {"message": "El sistema SESA está funcionando"}