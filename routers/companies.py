"""
CareerNest — Companies Router
"""
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from database import col_companies, col_jobs
from models import CompanyCreate
from utils import clean

router = APIRouter(prefix="/companies", tags=["Companies"])


@router.post("", status_code=201)
def create_company(data: CompanyCreate):
    cid = str(uuid.uuid4())
    doc = {**data.model_dump(), "id": cid,
           "created_at": datetime.utcnow(), "total_jobs_posted": 0}
    col_companies.insert_one(doc)
    return clean(doc)


@router.get("")
def list_companies():
    return {
        "companies": [clean(c) for c in col_companies.find()],
        "total":     col_companies.count_documents({}),
    }


@router.get("/{company_id}")
def get_company(company_id: str):
    c = col_companies.find_one({"id": company_id})
    if not c:
        raise HTTPException(404, "Company not found")
    jobs = [clean(j) for j in col_jobs.find({"company_id": company_id, "is_active": True})]
    return {"company": clean(c), "active_jobs": jobs, "active_jobs_count": len(jobs)}
