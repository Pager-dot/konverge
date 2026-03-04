"""
CareerNest — Pydantic Models & Enums
"""
from enum import Enum
from datetime import date
from typing import Optional, List
from pydantic import BaseModel, EmailStr


class JobType(str, Enum):
    full_time  = "Full-Time"
    part_time  = "Part-Time"
    internship = "Internship"
    contract   = "Contract"
    remote     = "Remote"
    hybrid     = "Hybrid"


class ExperienceLevel(str, Enum):
    entry      = "Entry Level"
    mid        = "Mid Level"
    senior     = "Senior Level"
    internship = "Internship / No Experience"


class ApplicationStatus(str, Enum):
    pending     = "Pending"
    reviewing   = "Reviewing"
    shortlisted = "Shortlisted"
    rejected    = "Rejected"
    accepted    = "Accepted"


class JobCategory(str, Enum):
    technology  = "Technology"
    finance     = "Finance"
    marketing   = "Marketing"
    design      = "Design"
    operations  = "Operations"
    hr          = "Human Resources"
    sales       = "Sales"
    engineering = "Engineering"
    healthcare  = "Healthcare"
    education   = "Education"
    other       = "Other"


# ── Company ───────────────────────────────────────────────
class CompanyCreate(BaseModel):
    name:        str
    industry:    str
    website:     Optional[str] = None
    description: Optional[str] = None
    logo_url:    Optional[str] = None
    location:    str


# ── Job ───────────────────────────────────────────────────
class JobCreate(BaseModel):
    title:                str
    company_id:           str
    category:             JobCategory
    job_type:             JobType
    experience_level:     ExperienceLevel
    location:             str
    is_remote:            bool               = False
    description:          str
    responsibilities:     List[str]
    requirements:         List[str]
    nice_to_have:         Optional[List[str]] = []
    salary_min:           Optional[int]       = None
    salary_max:           Optional[int]       = None
    salary_currency:      str                 = "INR"
    application_deadline: Optional[date]      = None
    openings:             int                 = 1
    tags:                 Optional[List[str]] = []


class JobUpdate(BaseModel):
    title:                Optional[str]       = None
    description:          Optional[str]       = None
    responsibilities:     Optional[List[str]] = None
    requirements:         Optional[List[str]] = None
    nice_to_have:         Optional[List[str]] = None
    salary_min:           Optional[int]       = None
    salary_max:           Optional[int]       = None
    application_deadline: Optional[date]      = None
    openings:             Optional[int]       = None
    is_active:            Optional[bool]      = None
    tags:                 Optional[List[str]] = None


# ── Application ───────────────────────────────────────────
class ApplicationCreate(BaseModel):
    applicant_name:      str
    applicant_email:     str
    google_access_token: Optional[str]   = None
    phone:               Optional[str]   = None
    resume_url:          str
    cover_letter:        Optional[str]   = None
    linkedin_url:        Optional[str]   = None
    portfolio_url:       Optional[str]   = None
    years_of_experience: Optional[float] = 0
    current_institution: Optional[str]   = None
    graduation_year:     Optional[int]   = None


class ApplicationCreateCompat(BaseModel):
    """Frontend-friendly shape for POST /applications."""
    job_id:              str
    full_name:           str
    email:               EmailStr
    google_access_token: Optional[str]   = None
    phone:               Optional[str]   = None
    resume_url:          str
    cover_letter:        Optional[str]   = None
    linkedin_url:        Optional[str]   = None
    portfolio_url:       Optional[str]   = None
    years_experience:    Optional[float] = 0
    institution:         Optional[str]   = None
    graduation_year:     Optional[int]   = None


class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus
    notes:  Optional[str] = None


# ── Bookmark ──────────────────────────────────────────────
class BookmarkCreate(BaseModel):
    student_email: str
    job_id:        str
