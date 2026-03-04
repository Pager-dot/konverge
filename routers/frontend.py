"""
CareerNest — Frontend HTML Serving
Serves index.html and admin.html from the project root.
Must be included AFTER all API routers so API routes take priority.
"""
from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import FileResponse

BASE_DIR = Path(__file__).resolve().parent.parent  # project root

router = APIRouter(include_in_schema=False)


@router.get("/admin")
@router.get("/admin.html")
def serve_admin():
    return FileResponse(BASE_DIR / "admin.html")


@router.get("/")
@router.get("/index.html")
def serve_index():
    return FileResponse(BASE_DIR / "index.html")
