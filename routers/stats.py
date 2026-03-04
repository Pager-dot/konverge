"""
CareerNest — Stats / Dashboard Router
"""
from fastapi import APIRouter
from database import col_companies, col_jobs, col_applications, col_bookmarks
from utils import clean

router = APIRouter(prefix="/stats", tags=["Dashboard"])


@router.get("")
def get_stats():
    jobs = list(col_jobs.find())
    apps = list(col_applications.find())

    cat_breakdown:  dict = {}
    type_breakdown: dict = {}
    for j in jobs:
        cat = j.get("category", "Other")
        cat_breakdown[cat]  = cat_breakdown.get(cat, 0) + 1
        jt  = j.get("job_type", "Other")
        type_breakdown[jt]  = type_breakdown.get(jt, 0) + 1

    status_breakdown: dict = {}
    for a in apps:
        st = str(a.get("status", "Pending"))
        status_breakdown[st] = status_breakdown.get(st, 0) + 1

    return {
        "overview": {
            "total_companies":    col_companies.count_documents({}),
            "total_jobs":         len(jobs),
            "active_jobs":        col_jobs.count_documents({"is_active": True}),
            "total_applications": len(apps),
            "total_bookmarks":    col_bookmarks.count_documents({}),
        },
        "jobs_by_category":       cat_breakdown,
        "jobs_by_type":           type_breakdown,
        "applications_by_status": status_breakdown,
        "most_viewed_jobs":  [clean(j) for j in sorted(jobs, key=lambda x: x.get("views", 0),              reverse=True)[:5]],
        "most_applied_jobs": [clean(j) for j in sorted(jobs, key=lambda x: x.get("applications_count", 0), reverse=True)[:5]],
    }
