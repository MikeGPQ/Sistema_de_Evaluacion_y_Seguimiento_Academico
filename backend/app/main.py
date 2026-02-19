import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.routers import students
load_dotenv()

app = FastAPI()

origins = os.getenv("BACKEND_CORS_ORIGINS").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(students.router)


@app.get("/")
def read_root():
    return {"message": "Hello World, Héctor."}


