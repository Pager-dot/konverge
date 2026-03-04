"""
CareerNest — Shared Utility Helpers
"""
from database import col_companies


def clean(doc: dict) -> dict:
    """Strip MongoDB _id from a document."""
    if doc and "_id" in doc:
        doc = dict(doc)
        del doc["_id"]
    return doc


def enrich_job(job: dict) -> dict:
    """Attach the parent company sub-document onto a job dict."""
    job = clean(job)
    company = col_companies.find_one({"id": job.get("company_id")})
    job["company"] = clean(company) if company else None
    return job
