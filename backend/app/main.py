import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.routers import students
from app.routers import mock_api
from app.routers import sync
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
from app.routers.sync import tarea_automatica_sincronizacion

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = BackgroundScheduler()
    # MODO PRUEBA: Ejecutar cada 1 minuto
    scheduler.add_job(tarea_automatica_sincronizacion, 'interval', minutes=1)
    
    # MODO PRODUCCIÓN: (Comentado por ahora) Ejecutar todos los días a las 3:00 AM
    # scheduler.add_job(tarea_automatica_sincronizacion, 'cron', hour=3, minute=0)
    
    scheduler.start()
    print("⏰ Cronjob de Sincronización Iniciado (Corriendo cada 1 minuto)")
    
    yield # Aquí arranca tu servidor normal
    
    scheduler.shutdown()
    print("🛑 Cronjob de Sincronización Detenido")

# Modifica tu declaración de FastAPI para que incluya el lifespan
app = FastAPI(lifespan=lifespan)



origins = os.getenv("BACKEND_CORS_ORIGINS").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(students.router)
app.include_router(mock_api.router)
app.include_router(sync.router)

@app.get("/")
def read_root():
    return {"message": "Hello World, Héctor."}


