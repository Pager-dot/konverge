"""
CareerNest — Database
MongoDB connection, collections, and index setup.
"""
import os
import certifi
from dotenv import load_dotenv
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.collection import Collection

load_dotenv()

MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017/careernest")

_client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
_db     = _client["careernest"]

col_companies:    Collection = _db["companies"]
col_jobs:         Collection = _db["jobs"]
col_applications: Collection = _db["applications"]
col_bookmarks:    Collection = _db["bookmarks"]

# ── Indexes ───────────────────────────────────────────────
col_companies.create_index("id", unique=True)
col_jobs.create_index("id", unique=True)
col_jobs.create_index("is_active")
col_jobs.create_index("company_id")
col_applications.create_index("id", unique=True)
col_applications.create_index(
    [("job_id", ASCENDING), ("applicant_email", ASCENDING)]
)
col_bookmarks.create_index(
    [("student_email", ASCENDING), ("job_id", ASCENDING)]
)
