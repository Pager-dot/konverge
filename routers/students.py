"""
CareerNest — Students Router
"""
from fastapi import APIRouter
from database import col_jobs, col_bookmarks
from utils import enrich_job

router = APIRouter(prefix="/students", tags=["Students"])


@router.get("/{email}/bookmarks")
def get_bookmarks(email: str):
    jobs = []
    for bm in col_bookmarks.find({"student_email": email}):
        job = col_jobs.find_one({"id": bm["job_id"]})
        if job:
            jobs.append(enrich_job(job))
    return {"bookmarks": jobs, "total": len(jobs)}
