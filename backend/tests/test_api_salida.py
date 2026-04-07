from datetime import date
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, LargeBinary
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.dialects.mysql import MEDIUMBLOB
from sqlalchemy import event
from sqlalchemy.engine import Engine
from app.db.database import Base, get_db
from app.main import app
from app.models.academic_group import AcademicGroup
from app.models.academic_period import AcademicPeriod
from app.models.enrollment import StudentEnrollment
from app.models.sigad_group import SigadGroup
from app.models.student import Student
from app.models.student_academic_profile import StudentAcademicProfile
from app.models.subject import Subject
from app.models.teacher import Teacher
from app.models.academic_program import AcademicProgram
from app.models.academic_level import AcademicLevel
from app.models.student_status import StudentStatus
from app.models.quarter_catalog import QuarterCatalog
from sqlalchemy.ext.compiler import compiles

@compiles(MEDIUMBLOB, "sqlite")
def compile_mediumblob_sqlite(type_, compiler, **kw):
    return "BLOB"


engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestSession()

    period = AcademicPeriod(
        id=1, codigo="2026-Q1", anio=2026,
        fecha_inicio=date(2026, 1, 1), fecha_fin=date(2026, 4, 30), is_active=True,
    )
    db.add(period)

    period2 = AcademicPeriod(
        id=2, codigo="2025-Q3", anio=2025,
        fecha_inicio=date(2025, 9, 1), fecha_fin=date(2025, 12, 31), is_active=False,
    )
    db.add(period2)

    career = AcademicProgram(id=1, codigo_unico="LISSC", name="Lic. Sistemas")
    db.add(career)

    quarter = QuarterCatalog(id=1, external_id=1, nombre="Primer Cuatrimestre")
    db.add(quarter)

    s1 = Subject(id=19, codigo_unico="LPR01", nombre="Lógica de Programación", period_id=1, creditos=6)
    s2 = Subject(id=20, codigo_unico="MAT01", nombre="Matemáticas I", period_id=1, creditos=6)
    db.add_all([s1, s2])

    g1 = SigadGroup(id=1, external_id=100, identificador="LISSC-2026-Q1", career_id=1, quarter_id=1)
    g2 = SigadGroup(id=2, external_id=101, identificador="LISSC-2026-Q2", career_id=1, quarter_id=1)
    db.add_all([g1, g2])

    teacher = Teacher(
        id=1, matricula_empleado="EMP001", sigad_docente_id=101,
        nombre="Juan", apellido_paterno="Pérez", apellido_materno="López",
        email_personal="juan@test.com",
    )
    db.add(teacher)

    ag1 = AcademicGroup(
        id=85, subject_id=19, teacher_id=1, sigad_group_id=1,
        period_id=1, estatus_acta="ABIERTA", promedio_consolidado=8.50,
        tiene_reporte_externo=True,
    )
    ag2 = AcademicGroup(
        id=86, subject_id=20, teacher_id=1, sigad_group_id=1,
        period_id=1, estatus_acta="ABIERTA", tiene_reporte_externo=False,
    )
    db.add_all([ag1, ag2])

    nivel = AcademicLevel(id=1, name="Licenciatura")
    status = StudentStatus(id=1, name="Activo")
    db.add_all([nivel, status])

    student = Student(
        matricula="STU001", nombre="Ana", apellido_paterno="García",
        apellido_materno="Ruiz", curp="GARA010101MCCRNN09",
        email_personal="ana@test.com",
    )
    db.add(student)

    profile = StudentAcademicProfile(
        id=1, student_matricula="STU001", nivel_id=1, career_id=1,
        promedio_procedencia=85, status_id=1, quarter_actual_id=1, period_id=1,
    )
    db.add(profile)

    e1 = StudentEnrollment(
        id=1, student_matricula="STU001", academic_profile_id=1,
        academic_group_id=85, period_id=1,
        calificacion_final=9, status="aprobada",
    )
    e2 = StudentEnrollment(
        id=2, student_matricula="STU001", academic_profile_id=1,
        academic_group_id=85, period_id=1,
        calificacion_final=8, status="aprobada",
    )

    e3 = StudentEnrollment(
        id=3, student_matricula="STU001", academic_profile_id=1,
        academic_group_id=85, period_id=1,
        calificacion_final=None, status="cursando",
    )
    db.add_all([e1, e2, e3])

    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=engine)


def test_materias_recepcion_ok():
    resp = client.get("/api/materias/recepcion")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert body["page"] == 1
    assert body["data"][0]["id_materia"] in [19, 20]
    assert "codigo_unico" in body["data"][0]
    assert "nombre" in body["data"][0]


def test_materias_recepcion_pagination():
    resp = client.get("/api/materias/recepcion?page=1&page_size=1")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["data"]) == 1
    assert body["total"] == 2


def test_grupos_recepcion_ok():
    resp = client.get("/api/grupos/recepcion")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert body["data"][0]["identificador"] in ["LISSC-2026-Q1", "LISSC-2026-Q2"]


def test_asignaciones_promedio_ok():
    resp = client.get("/api/asignaciones/recepcion?materia_id=19&grupo_id=1")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id_asignacion"] == 85
    assert body["promedio_consolidado"] == 8.5


def test_asignaciones_promedio_404():
    resp = client.get("/api/asignaciones/recepcion?materia_id=999&grupo_id=999")
    assert resp.status_code == 404


def test_asignaciones_promedio_null():
    resp = client.get("/api/asignaciones/recepcion?materia_id=20&grupo_id=1")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id_asignacion"] == 86
    assert body["promedio_consolidado"] is None


def test_asignaciones_incumplimientos_ok():
    resp = client.get("/api/asignaciones/recepcion?grupo_id=1&periodo_id=1")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert body["data"][0]["docente_id"] == 101
    flags = {d["id_asignacion"]: d["tiene_reporte_externo"] for d in body["data"]}
    assert flags[85] == 1
    assert flags[86] == 0


def test_asignaciones_incumplimientos_404():
    resp = client.get("/api/asignaciones/recepcion?grupo_id=999&periodo_id=999")
    assert resp.status_code == 404


def test_asignaciones_bad_params():
    resp = client.get("/api/asignaciones/recepcion")
    assert resp.status_code == 400


def test_asignaciones_only_materia_id():
    resp = client.get("/api/asignaciones/recepcion?materia_id=19")
    assert resp.status_code == 400