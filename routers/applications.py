"""
CareerNest — Applications Router
"""
import uuid
import requests
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from database import col_companies, col_jobs, col_applications
from models import (
    ApplicationCreate, ApplicationCreateCompat,
    ApplicationStatus, ApplicationStatusUpdate,
)
from utils import clean

router = APIRouter(tags=["Applications"])


def _submit_application(job_id: str, data: ApplicationCreate) -> dict:
    job = col_jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(404, "Job not found")
    if not job.get("is_active", True):
        raise HTTPException(400, "This job listing is no longer active")

    if data.google_access_token:
        try:
            resp = requests.get(
                "https://www.googleapis.com/oauth2/v3/tokeninfo",
                params={"access_token": data.google_access_token},
                timeout=5,
            )
            if resp.status_code != 200:
                raise HTTPException(401, "Invalid Google authentication token.")
            if resp.json().get("email") != data.applicant_email:
                raise HTTPException(403, "Email mismatch with Google account.")
        except HTTPException:
            raise
        except Exception:
            pass

    if col_applications.find_one({"job_id": job_id, "applicant_email": data.applicant_email}):
        raise HTTPException(409, "You have already applied for this job")

    company = col_companies.find_one({"id": job.get("company_id")})
    now     = datetime.utcnow()
    app_doc = {
        **data.model_dump(),
        "id":           str(uuid.uuid4()),
        "job_id":       job_id,
        "job_title":    job["title"],
        "company_name": company.get("name", "Unknown") if company else "Unknown",
        "status":       ApplicationStatus.pending,
        "applied_at":   now,
        "updated_at":   now,
        "notes":        None,
    }
    col_applications.insert_one(app_doc)
    col_jobs.update_one({"id": job_id}, {"$inc": {"applications_count": 1}})
    return clean(app_doc)


@router.post("/jobs/{job_id}/apply", status_code=201)
def apply_for_job(job_id: str, data: ApplicationCreate):
    app_doc = _submit_application(job_id, data)
    return {"message": "Application submitted successfully!",
            "application_id": app_doc["id"], "application": app_doc}


@router.post("/applications", status_code=201, summary="Apply for a job (frontend compat)")
def apply_for_job_compat(data: ApplicationCreateCompat):
    mapped = ApplicationCreate(
        applicant_name=      data.full_name,
        applicant_email=     str(data.email),
        google_access_token= data.google_access_token,
        phone=               data.phone,
        resume_url=          data.resume_url,
        cover_letter=        data.cover_letter,
        linkedin_url=        data.linkedin_url,
        portfolio_url=       data.portfolio_url,
        years_of_experience= data.years_experience,
        current_institution= data.institution,
        graduation_year=     data.graduation_year,
    )
    app_doc = _submit_application(data.job_id, mapped)
    return {"message": "Application submitted successfully!",
            "application_id": app_doc["id"], "application": app_doc}


@router.get("/jobs/{job_id}/applications")
def get_job_applications(job_id: str, status: Optional[ApplicationStatus] = Query(None)):
    if not col_jobs.find_one({"id": job_id}):
        raise HTTPException(404, "Job not found")
    q: dict = {"job_id": job_id}
    if status: q["status"] = status
    apps = [clean(a) for a in col_applications.find(q)]
    return {"applications": apps, "total": len(apps)}


@router.get("/applications/{application_id}")
def get_application(application_id: str):
    a = col_applications.find_one({"id": application_id})
    if not a:
        raise HTTPException(404, "Application not found")
    return clean(a)


@router.patch("/applications/{application_id}/status")
def update_application_status(application_id: str, data: ApplicationStatusUpdate):
    if not col_applications.find_one({"id": application_id}):
        raise HTTPException(404, "Application not found")
    updates = {"status": data.status, "updated_at": datetime.utcnow()}
    if data.notes: updates["notes"] = data.notes
    col_applications.update_one({"id": application_id}, {"$set": updates})
    return {
        "message": f"Status updated to '{data.status}'",
        "application": clean(col_applications.find_one({"id": application_id})),
    }


@router.get("/students/{email}/applications", summary="Get all applications by student email")
def get_student_applications(email: str):
    apps = [clean(a) for a in col_applications.find({"applicant_email": email})]
    return {
        "applications": apps,
        "total": len(apps),
        "message": None if apps else "No applications found for this email",
    }
