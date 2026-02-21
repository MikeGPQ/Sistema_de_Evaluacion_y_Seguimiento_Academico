import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.db.database import engine
from sqlalchemy import text 
from app.routers import Listados

from app.routers.students import router as students_router

load_dotenv()

app = FastAPI(title="SESA API", version="1.0.0")

origins = os.getenv("BACKEND_CORS_ORIGINS").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(students_router)
app.include_router(Listados.router)

@app.get("/")
def read_root():
    return {"message": "Hello World, Héctor."}

@app.on_event("startup")
def startup_db_client():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        print("\n✅✅ ¡CONEXIÓN A BASE DE DATOS EXITOSA! ✅✅\n")
    except Exception as e:
        print(f"\n❌❌ ERROR AL CONECTAR A LA BD: {e} ❌❌\n")