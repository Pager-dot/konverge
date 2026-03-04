"""
CareerNest — Bookmarks Router
"""
from datetime import datetime
from fastapi import APIRouter, HTTPException
from database import col_jobs, col_bookmarks
from models import BookmarkCreate
from utils import enrich_job

router = APIRouter(prefix="/bookmarks", tags=["Bookmarks"])


@router.post("", status_code=201)
def bookmark_job(data: BookmarkCreate):
    if not col_jobs.find_one({"id": data.job_id}):
        raise HTTPException(404, "Job not found")
    if col_bookmarks.find_one({"student_email": data.student_email, "job_id": data.job_id}):
        raise HTTPException(409, "Job already bookmarked")
    col_bookmarks.insert_one({
        "student_email": data.student_email,
        "job_id":        data.job_id,
        "saved_at":      datetime.utcnow(),
    })
    return {"message": "Job bookmarked successfully"}


@router.delete("")
def remove_bookmark(data: BookmarkCreate):
    if col_bookmarks.delete_one(
        {"student_email": data.student_email, "job_id": data.job_id}
    ).deleted_count == 0:
        raise HTTPException(404, "Bookmark not found")
    return {"message": "Bookmark removed"}
