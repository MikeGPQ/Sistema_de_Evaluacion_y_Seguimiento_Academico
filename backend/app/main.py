import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# 1. IMPORTAR EL ROUTER DE ESTUDIANTES
from app.routers import students 

load_dotenv()

app = FastAPI()

# Evitar error si la variable de entorno no existe o está vacía
origins_env = os.getenv("BACKEND_CORS_ORIGINS")
origins = origins_env.split(",") if origins_env else ["http://localhost:5173", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. CONECTAR EL ROUTER A LA APP
app.include_router(students.router)

@app.get("/")
def read_root():
    return {"message": "El sistema SESA está funcionando 🚀"}