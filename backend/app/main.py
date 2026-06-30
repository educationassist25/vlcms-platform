"""
Virtual LC-MS Platform - FastAPI Backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.db.database import engine, Base
from app.api import (metabolites, columns, mobile_phases, simulate,
                     mrm, isotope, methods, auth, copilot,
                     router_ml, router_enrichment, router_resolver)
from app.db.seed import seed_database
from app.models.models import Metabolite, Column_, MobilePhase, AtomMapping, User


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)

    from app.db.database import SessionLocal
    db = SessionLocal()
    met_count = db.query(Metabolite).count()
    col_count  = db.query(Column_).count()
    db.close()

    # Force reseed if DB has old/incomplete data
    if met_count < 90 or col_count < 9:
        db2 = SessionLocal()
        try:
            # Clear all existing data
            db2.query(AtomMapping).delete()
            db2.query(Metabolite).delete()
            db2.query(Column_).delete()
            db2.query(MobilePhase).delete()
            db2.query(User).delete()
            db2.commit()
        except Exception as e:
            db2.rollback()
        finally:
            db2.close()
        seed_database()

    yield


app = FastAPI(
    title="Virtual LC-MS Metabolomics Simulator",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,          prefix="/api/v1/auth",          tags=["Auth"])
app.include_router(metabolites.router,   prefix="/api/v1/metabolites",   tags=["Metabolites"])
app.include_router(columns.router,       prefix="/api/v1/columns",       tags=["Columns"])
app.include_router(mobile_phases.router, prefix="/api/v1/mobile-phases", tags=["Mobile Phases"])
app.include_router(simulate.router,      prefix="/api/v1/simulate",      tags=["Simulation"])
app.include_router(mrm.router,           prefix="/api/v1/mrm",           tags=["MRM"])
app.include_router(isotope.router,       prefix="/api/v1/isotope",       tags=["Isotope"])
app.include_router(methods.router,       prefix="/api/v1/methods",       tags=["Methods"])
app.include_router(copilot.router,       prefix="/api/v1/copilot",       tags=["AI Copilot"])
app.include_router(router_ml,            prefix="/api/v1/ml",            tags=["ML Optimizer"])
app.include_router(router_enrichment,    prefix="/api/v1/enrichment",    tags=["Enrichment"])
app.include_router(router_resolver,      prefix="/api/v1/resolver",      tags=["Co-Elution Resolver"])


@app.get("/api/health")
def health():
    from app.db.database import SessionLocal
    db = SessionLocal()
    met_count = db.query(Metabolite).count()
    col_count  = db.query(Column_).count()
    db.close()
    return {
        "status": "ok",
        "version": "1.0.0",
        "metabolites": met_count,
        "columns": col_count,
    }
