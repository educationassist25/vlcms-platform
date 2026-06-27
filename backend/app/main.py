"""
Virtual LC-MS Method Development & Metabolomics Simulator
FastAPI Backend — Production Entry Point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from app.db.database import engine, Base
from app.api import metabolites, columns, mobile_phases, simulate, mrm, isotope, methods, auth, copilot
from app.api import router_ml, router_enrichment
from app.db.seed import seed_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables and seed data
    Base.metadata.create_all(bind=engine)
    seed_database()
    yield

app = FastAPI(
    title="Virtual LC-MS Metabolomics Simulator",
    description="Commercial-grade LC-MS method development and metabolomics simulation platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routers
app.include_router(auth.router,         prefix="/api/v1/auth",         tags=["Auth"])
app.include_router(metabolites.router,  prefix="/api/v1/metabolites",  tags=["Metabolites"])
app.include_router(columns.router,      prefix="/api/v1/columns",      tags=["Columns"])
app.include_router(mobile_phases.router,prefix="/api/v1/mobile-phases",tags=["Mobile Phases"])
app.include_router(simulate.router,     prefix="/api/v1/simulate",     tags=["Simulation"])
app.include_router(mrm.router,          prefix="/api/v1/mrm",          tags=["MRM"])
app.include_router(isotope.router,      prefix="/api/v1/isotope",      tags=["Isotope"])
app.include_router(methods.router,      prefix="/api/v1/methods",      tags=["Methods"])
app.include_router(copilot.router,      prefix="/api/v1/copilot",      tags=["AI Copilot"])
app.include_router(router_ml,           prefix="/api/v1/ml",           tags=["ML Optimizer"])
app.include_router(router_enrichment,   prefix="/api/v1/enrichment",   tags=["Enrichment"])

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0", "platform": "Virtual LC-MS Simulator"}
