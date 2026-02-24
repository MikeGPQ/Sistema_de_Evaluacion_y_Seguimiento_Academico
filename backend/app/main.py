import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from sqlalchemy import text 
from app.routers import Listados
from app.db.database import engine
from app.routers.students import router as students_router
from app.routers import auth

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        print("\n¡CONEXIÓN A BASE DE DATOS EXITOSA!\n")
    except Exception as e:
        print(f"\nERROR AL CONECTAR A LA BD: {e}\n")
    
    yield

app = FastAPI(title="SESA API", version="1.0.0", lifespan=lifespan)

origins_env = os.getenv("BACKEND_CORS_ORIGINS")
origins = origins_env.split(",") if origins_env else ["http://localhost:5173", "http://127.0.0.1:5173"]

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

@app.get("/")
def read_root():
    return {"message": "El sistema SESA está funcionando"}