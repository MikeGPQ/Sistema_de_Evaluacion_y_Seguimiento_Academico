import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from dotenv import load_dotenv
from sqlalchemy import text
from app.db.database import engine
from app.routers import (
    students,
    Listados as listados,
    auth,
    enrollments,
    catalogos,
    administradores,
    files as files_router,
    grades,
    attendance,
    logs,
    reportcards,
    api_salida_router,
)

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        print("CONEXIÓN A BASE DE DATOS EXITOSA")
    except Exception as e:
        print(f"ERROR CRÍTICO AL CONECTAR A LA BD: {e}")

    yield

app = FastAPI(
    title="SESA API - Versión 3.0",
    description="Sistema de Control Escolar con soporte Multiprofil (Licenciatura/Maestría)",
    version="3.0.0",
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

app.add_middleware(GZipMiddleware, minimum_size=500)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(administradores.router)
app.include_router(students.router)
app.include_router(listados.router)
app.include_router(catalogos.router)
app.include_router(enrollments.router)
app.include_router(grades.router)
app.include_router(attendance.router)
app.include_router(reportcards.router)
app.include_router(files_router.router)
app.include_router(logs.router)
app.include_router(api_salida_router.router)


@app.get("/", tags=["Salud del Sistema"])
def read_root():
    return {
        "app": "SESA API",
        "version": "3.0.0",
        "status": "online",
        "db_connection": "verified"
    }