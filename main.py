"""
CareerNest — FastAPI Entry Point

Run locally:   uvicorn main:app --reload --port 7860
HuggingFace:   uvicorn main:app --host 0.0.0.0 --port 7860

All frontend config (Google Client ID, admin emails, API base URL)
is served dynamically from environment variables via GET /config.js.
No static config.js file is needed or committed to the repo.
"""
import sys
from pathlib import Path

# Make routers importable as bare module names (flat layout)
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from seed import seed_database
from database import col_companies, col_jobs, col_applications

from routers import (
    companies, jobs, applications,
    bookmarks, students, stats,
    frontend, config_route,
)

# ── Seed on first start ───────────────────────────────────
seed_database()

# ── App ───────────────────────────────────────────────────
app = FastAPI(
    title="CareerNest Job Board API",
    description="""
## Centralized Opportunity Management — Job Board API

Powered by FastAPI + MongoDB. All data persists across restarts.

### Quick Start
1. `POST /companies` — register a company
2. `POST /jobs` — post a listing
3. `GET  /jobs` — browse listings
4. `POST /applications` — submit an application
""",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Health check ──────────────────────────────────────────
@app.get("/health", tags=["General"])
def health():
    return {
        "status":             "CareerNest API is running",
        "total_companies":    col_companies.count_documents({}),
        "total_jobs":         col_jobs.count_documents({}),
        "active_jobs":        col_jobs.count_documents({"is_active": True}),
        "total_applications": col_applications.count_documents({}),
        "docs":               "/docs",
    }

# ── /config.js — served dynamically from env vars ────────
# Must come BEFORE the static root mount so it's not shadowed
app.include_router(config_route.router)

# ── API routers ───────────────────────────────────────────
app.include_router(companies.router)
app.include_router(jobs.router)
app.include_router(applications.router)
app.include_router(bookmarks.router)
app.include_router(students.router)
app.include_router(stats.router)

# ── Static assets: /static/style.css, /static/script.js … ─
BASE_DIR = Path(__file__).resolve().parent
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

# ── Frontend HTML routes ──────────────────────────────────
app.include_router(frontend.router)

# ── Catch-all: serve index.html, admin.html, etc. ─────────
# config.js is intentionally NOT in this directory anymore
app.mount("/", StaticFiles(directory=str(BASE_DIR)), name="root")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=7860, reload=False)