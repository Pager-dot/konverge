"""
CareerNest — Seed Data
Populates MongoDB with starter data. Only runs when DB is empty.
"""
import uuid
from datetime import datetime
from database import col_companies, col_jobs


def seed_database() -> None:
    if col_companies.count_documents({}) > 0:
        print("MongoDB already seeded — skipping.")
        return

    print("Seeding MongoDB with initial data...")
    c1, c2, c3 = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())
    now = datetime.utcnow()

    col_companies.insert_many([
        {
            "id": c1, "name": "TechNova Solutions", "industry": "Software Development",
            "website": "https://technova.io",
            "logo_url": "https://placehold.co/100x100?text=TN",
            "description": "Building next-gen cloud platforms for enterprises.",
            "location": "Bangalore, India", "created_at": now, "total_jobs_posted": 2,
        },
        {
            "id": c2, "name": "FinEdge Capital", "industry": "Finance & Fintech",
            "website": "https://finedge.in",
            "logo_url": "https://placehold.co/100x100?text=FE",
            "description": "Democratizing investment for retail investors.",
            "location": "Mumbai, India", "created_at": now, "total_jobs_posted": 1,
        },
        {
            "id": c3, "name": "DesignPulse Agency", "industry": "Design & Creative",
            "website": "https://designpulse.co",
            "logo_url": "https://placehold.co/100x100?text=DP",
            "description": "Award-winning UI/UX agency.",
            "location": "Hyderabad, India", "created_at": now, "total_jobs_posted": 1,
        },
    ])

    seeds = [
        {
            "title": "Backend Engineering Intern", "company_id": c1,
            "category": "Technology", "job_type": "Internship",
            "experience_level": "Internship / No Experience",
            "location": "Bangalore, India", "is_remote": True,
            "description": "Join our core backend team and build production-grade REST APIs.",
            "responsibilities": ["Develop REST APIs using FastAPI", "Write unit tests", "Participate in standups"],
            "requirements": ["Pursuing B.Tech/BE in CS", "Proficiency in Python", "Understands HTTP/REST"],
            "nice_to_have": ["Docker experience", "Open-source contributions"],
            "salary_min": 15000, "salary_max": 25000, "salary_currency": "INR",
            "application_deadline": "2025-09-30", "openings": 3,
            "tags": ["python", "fastapi", "backend", "intern"],
        },
        {
            "title": "Full Stack Developer", "company_id": c1,
            "category": "Technology", "job_type": "Full-Time",
            "experience_level": "Mid Level",
            "location": "Bangalore, India", "is_remote": False,
            "description": "We're looking for a Full Stack Developer to join our product team.",
            "responsibilities": ["Ship product features", "Collaborate with designers", "Mentor junior engineers"],
            "requirements": ["2+ years experience", "React + Node.js or Python", "PostgreSQL experience"],
            "nice_to_have": ["AWS/GCP experience", "TypeScript"],
            "salary_min": 800000, "salary_max": 1400000, "salary_currency": "INR",
            "application_deadline": "2025-10-15", "openings": 2,
            "tags": ["react", "nodejs", "fullstack", "postgres"],
        },
        {
            "title": "Finance & Investment Intern", "company_id": c2,
            "category": "Finance", "job_type": "Internship",
            "experience_level": "Internship / No Experience",
            "location": "Mumbai, India", "is_remote": False,
            "description": "Get real-world exposure to equity research and financial modelling.",
            "responsibilities": ["Equity research", "Build financial models", "Prepare investment memos"],
            "requirements": ["MBA (Finance) or B.Com final year", "Strong Excel skills"],
            "nice_to_have": ["CFA Level 1", "Bloomberg Terminal"],
            "salary_min": 20000, "salary_max": 30000, "salary_currency": "INR",
            "application_deadline": "2025-09-20", "openings": 2,
            "tags": ["finance", "equity", "excel", "intern"],
        },
        {
            "title": "UI/UX Design Intern", "company_id": c3,
            "category": "Design", "job_type": "Internship",
            "experience_level": "Internship / No Experience",
            "location": "Hyderabad, India", "is_remote": True,
            "description": "Work alongside senior designers on real client projects.",
            "responsibilities": ["Create wireframes and prototypes", "User research", "Dev handoff"],
            "requirements": ["Degree in Design/HCI", "Proficient in Figma", "Portfolio required"],
            "nice_to_have": ["Motion design", "Design systems experience"],
            "salary_min": 12000, "salary_max": 18000, "salary_currency": "INR",
            "application_deadline": "2025-10-01", "openings": 1,
            "tags": ["figma", "ux", "ui", "design", "intern"],
        },
    ]

    for s in seeds:
        col_jobs.insert_one({
            **s, "id": str(uuid.uuid4()),
            "is_active": True, "views": 0, "applications_count": 0,
            "created_at": now, "updated_at": now,
        })

    print(f"Seeded 3 companies and {len(seeds)} jobs.")
