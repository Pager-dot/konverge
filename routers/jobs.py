"""
CareerNest — Jobs Router
"""
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pymongo import ASCENDING, DESCENDING
from database import col_companies, col_jobs
from models import JobCreate, JobUpdate
from utils import enrich_job

router = APIRouter(prefix="/jobs", tags=["Jobs"])

SORT_MAP = {
    "newest":       [("created_at",         DESCENDING)],
    "oldest":       [("created_at",         ASCENDING)],
    "salary_high":  [("salary_max",         DESCENDING)],
    "salary_low":   [("salary_min",         ASCENDING)],
    "most_applied": [("applications_count", DESCENDING)],
}


@router.post("", status_code=201)
def create_job(data: JobCreate):
    if not col_companies.find_one({"id": data.company_id}):
        raise HTTPException(404, "Company not found. Create the company first.")
    jid = str(uuid.uuid4())
    now = datetime.utcnow()
    doc = {
        **data.model_dump(),
        "application_deadline": str(data.application_deadline) if data.application_deadline else None,
        "id": jid, "is_active": True, "views": 0, "applications_count": 0,
        "created_at": now, "updated_at": now,
    }
    col_jobs.insert_one(doc)
    col_companies.update_one({"id": data.company_id}, {"$inc": {"total_jobs_posted": 1}})
    return {"message": "Job posted successfully", "job": enrich_job(doc)}


@router.get("")
def list_jobs(
    search:           Optional[str]  = Query(None),
    category:         Optional[str]  = Query(None),
    job_type:         Optional[str]  = Query(None),
    experience_level: Optional[str]  = Query(None),
    location:         Optional[str]  = Query(None),
    is_remote:        Optional[bool] = Query(None),
    salary_min:       Optional[int]  = Query(None),
    active_only:      bool           = Query(True),
    sort_by:          str            = Query("newest"),
    page:             int            = Query(1, ge=1),
    page_size:        int            = Query(10, ge=1, le=50),
):
    q: dict = {}
    if active_only: q["is_active"] = True
    if search:
        q["$or"] = [
            {"title":       {"$regex": search.strip(), "$options": "i"}},
            {"description": {"$regex": search.strip(), "$options": "i"}},
            {"tags":        {"$elemMatch": {"$regex": search.strip(), "$options": "i"}}},
        ]
    if category:           q["category"]        = {"$regex": category.strip(),        "$options": "i"}
    if job_type:           q["job_type"]         = {"$regex": job_type.strip(),         "$options": "i"}
    if experience_level:   q["experience_level"] = {"$regex": experience_level.strip(), "$options": "i"}
    if location:           q["location"]         = {"$regex": location.strip(),          "$options": "i"}
    if is_remote is not None: q["is_remote"]     = is_remote
    if salary_min is not None: q["salary_max"]   = {"$gte": salary_min}

    sort_order = SORT_MAP.get(sort_by, SORT_MAP["newest"])
    total = col_jobs.count_documents(q)
    skip  = (page - 1) * page_size
    jobs  = [enrich_job(j) for j in col_jobs.find(q).sort(sort_order).skip(skip).limit(page_size)]

    return {
        "jobs": jobs,
        "pagination": {
            "total":       total,
            "page":        page,
            "page_size":   page_size,
            "total_pages": max(1, (total + page_size - 1) // page_size),
        },
    }


@router.get("/{job_id}")
def get_job(job_id: str):
    job = col_jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(404, "Job not found")
    col_jobs.update_one({"id": job_id}, {"$inc": {"views": 1}})
    job["views"] = job.get("views", 0) + 1
    return enrich_job(job)


@router.patch("/{job_id}")
def update_job(job_id: str, data: JobUpdate):
    if not col_jobs.find_one({"id": job_id}):
        raise HTTPException(404, "Job not found")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.utcnow()
    col_jobs.update_one({"id": job_id}, {"$set": updates})
    return {"message": "Job updated", "job": enrich_job(col_jobs.find_one({"id": job_id}))}


@router.delete("/{job_id}")
def delete_job(job_id: str):
    if col_jobs.delete_one({"id": job_id}).deleted_count == 0:
        raise HTTPException(404, "Job not found")
    return {"message": "Job deleted successfully"}
