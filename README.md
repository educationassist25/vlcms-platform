# Virtual LC-MS Metabolomics Simulator v1.0.0

Commercial-grade LC-MS method development and metabolomics simulation platform.

## Quick Start

```bash
chmod +x start.sh
./start.sh
```

Open **http://localhost:3000** — login with `demo@vlcms.io / demo1234`

---

## Platform Modules

| Tab | Function |
|-----|----------|
| **Simulate** | Predict RT, peak shape, resolution matrix, ion suppression, chromatogram |
| **MRM Workbench** | Generate MRM transitions for Agilent/SCIEX/Waters with CSV export |
| **Isotope Tracer** | ¹³C/¹⁵N/²H isotopologue generation, MID values, NAC, FE |
| **Methods** | Save, load, and manage LC-MS methods with gradient editor |
| **AI Copilot** | Claude-powered scientific Q&A with LC-MS knowledge base |

## Architecture

```
vlcms/
├── backend/           # Python FastAPI
│   ├── app/
│   │   ├── main.py             # FastAPI entry point
│   │   ├── api/__init__.py     # All route handlers
│   │   ├── db/
│   │   │   ├── database.py     # SQLAlchemy / SQLite
│   │   │   └── seed.py         # 22 metabolites, 10 columns, 6 mobile phases
│   │   ├── models/models.py    # ORM models
│   │   └── services/
│   │       ├── chroma_engine.py    # QSRR RT engine + EMG peaks
│   │       ├── mrm_generator.py    # MRM transitions (4 instrument platforms)
│   │       └── isotope_service.py  # Isotopologue + NAC + MID
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/          # Next.js 14 + TypeScript
│   ├── app/
│   │   ├── page.tsx            # Main shell + tab routing
│   │   ├── lib/api.ts          # Typed API client
│   │   └── components/
│   │       ├── SimulateTab.tsx
│   │       ├── MRMTab.tsx
│   │       ├── IsotopeTab.tsx
│   │       ├── MethodsTab.tsx
│   │       └── CopilotTab.tsx
│   └── Dockerfile
├── docker-compose.yml
├── start.sh
└── README.md
```

## API Reference

`GET  /api/docs`                        — Interactive Swagger UI  
`GET  /api/v1/metabolites?q=citrate`    — Search metabolites  
`GET  /api/v1/columns?mode=HILIC`       — Filter columns by mode  
`POST /api/v1/simulate/retention-time`  — Predict RT + peak params  
`POST /api/v1/simulate/gradient-optimize` — LSS gradient optimization  
`POST /api/v1/mrm/generate`             — Generate MRM transitions  
`POST /api/v1/mrm/scheduled`            — Scheduled MRM with dwell optimization  
`POST /api/v1/isotope/generate-isotopologues` — Isotopologue MID + MRM  
`GET  /api/v1/isotope/atom-map/{sub}/{prod}` — Carbon atom mapping  
`POST /api/v1/methods`                  — Save LC-MS method  
`POST /api/v1/copilot/ask`              — AI scientific Q&A  

## Science

### RT Prediction
- Per-compound calibrated RT database (22 metabolites, based on published metabolomics datasets)
- LSS gradient theory for gradient scaling
- Column chemistry selectivity modifiers (C18, T3, CSH, EVO, HILIC variants)
- pH / ionisation corrections via Henderson-Hasselbalch
- Van Deemter plate count model; EMG peak tailing

### MRM Generation
- In-silico fragmentation rules per metabolite class (8 classes)
- Empirical CE prediction calibrated to published Agilent/SCIEX/Waters CE databases
- Instrument-specific parameters (Fragmentor V, DP, CAV, CXP, Cone V, Dwell)
- Scheduled MRM with dwell time optimization per RT segment

### Isotope Tracing
- ¹³C-glucose, ¹³C-glutamine, ¹³C-palmitate, ¹⁵N-glutamine, ²H-glucose tracers
- Known MID distributions from published flux experiments (Metab 2019, Cell Metab 2021)
- IsoCor-compatible natural abundance correction
- Fractional enrichment calculation
- Isotopologue-specific MRM transitions

## Docker Deployment

```bash
docker compose up --build
```

Services: backend on :8000, frontend on :3000

## Demo Credentials

Email: `demo@vlcms.io`  
Password: `demo1234`
