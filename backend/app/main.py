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
from app.routers.sync import tarea_automatica_sincronizacion

# ✅ Cargar variables de entorno
load_dotenv()

# ==========================================
# LIFESPAN (Scheduler + DB Check)
# ==========================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = BackgroundScheduler()
    scheduler.add_job(tarea_automatica_sincronizacion, 'interval', minutes=1)
    # PRODUCCIÓN:
    # scheduler.add_job(tarea_automatica_sincronizacion, 'cron', hour=3, minute=0)
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

# ==========================================
# APP
# ==========================================

app = FastAPI(
    title="SESA API",
    version="1.0.0",
    lifespan=lifespan
)

# ==========================================
# CONFIGURACIÓN CORS (ARREGLADA)
# ==========================================

origins_env = os.getenv("BACKEND_CORS_ORIGINS", "")
origins = [o.strip() for o in origins_env.split(",") if o.strip()]

# Fallback seguro en desarrollo
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

# ==========================================
# ROUTERS
# ==========================================

app.include_router(students_router)
app.include_router(Listados.router)
app.include_router(auth.router)
app.include_router(mock_api.router)
app.include_router(sync.router)

# ==========================================
# ROOT
# ==========================================

@app.get("/")
def read_root():
    return {"message": "El sistema SESA está funcionando"}