# CareerNest 

**Centralized Opportunity Management — Job Board Platform**

A full-stack job board built for students and campus communities. Companies post listings, students browse and apply, and admins manage everything through a protected panel. Powered by **FastAPI + MongoDB** on the backend and plain HTML/CSS/JS on the frontend. Deployable to HuggingFace Spaces in minutes.

---

## ✨ Features

- 🔍 Browse & search job listings with live filters (category, type, location, salary, remote)
- 📋 Detailed job view with responsibilities, requirements, and salary info
- ✅ 2-step application form with Google Sign-In auto-fill
- 🔖 Bookmark jobs (saved to localStorage)
- 👤 Track your applications by email (pulled live from the backend)
- 🛡️ Admin panel protected by Google OAuth — only whitelisted emails can access
- 📊 Live stats dashboard (jobs, companies, applications, internships)
- 🌱 Auto-seeded with sample data on first start
- 🔑 Zero static credentials — all config served dynamically from environment variables

---

## 🗂️ Folder Structure

```
careernest/
│
│   # ── Root files ───────────────────────────────────────────
├── main.py              # FastAPI app entry point — wires all routers
├── database.py          # MongoDB connection, collections, and indexes
├── models.py            # All Pydantic models and enums
├── utils.py             # Shared helpers: clean(), enrich_job()
├── seed.py              # Seeds starter data on first run (skips if DB has data)
│
│   # ── API Routers ──────────────────────────────────────────
├── routers/
│   ├── __init__.py
│   ├── companies.py     # GET/POST /companies
│   ├── jobs.py          # GET/POST/PATCH/DELETE /jobs
│   ├── applications.py  # POST /applications, GET /students/{email}/applications
│   ├── bookmarks.py     # POST/DELETE /bookmarks
│   ├── students.py      # GET /students/{email}/bookmarks
│   ├── stats.py         # GET /stats  (dashboard overview)
│   ├── frontend.py      # Serves index.html and admin.html
│   └── config_route.py  # GET /config.js — generates JS config from env vars
│
│   # ── Frontend ─────────────────────────────────────────────
├── index.html           # Student-facing job board UI
├── admin.html           # Admin panel (Google-auth gated)
├── static/
│   ├── style.css        # Shared styles for both pages
│   ├── script.js        # All JS for index.html
│   └── admin.js         # All JS for admin.html
│
│   # ── Config & Deploy ──────────────────────────────────────
├── .env                 # Your local secrets — never commit this
├── .env.example         # Template showing all required variables
├── requirements.txt     # Python dependencies
└── Dockerfile           # HuggingFace Spaces compatible Docker config
```

---

## 🔑 Environment Variables

All configuration lives in a single `.env` file. The backend reads these at startup and also serves them to the frontend dynamically via `GET /config.js` — so **no credentials are ever hardcoded** in HTML or JS files.

### Full `.env` reference

```dotenv
# ── Database ─────────────────────────────────────────────────
# Your MongoDB Atlas connection string
# Free tier at https://cloud.mongodb.com — create a cluster, then:
# Database → Connect → Drivers → copy the connection string
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/careernest?retryWrites=true&w=majority

# ── Google OAuth ─────────────────────────────────────────────
# From https://console.cloud.google.com
# APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web application)
# Add your domain to "Authorized JavaScript origins"
GOOGLE_CLIENT_ID=175096449908-xxxxxxxxxxxxxxxx.apps.googleusercontent.com

# ── Admin Access ─────────────────────────────────────────────
# Comma-separated Gmail addresses that can access /admin
# Anyone not in this list will be denied even after signing in
ADMIN_EMAILS=you@gmail.com,colleague@gmail.com

# ── API Base URL ─────────────────────────────────────────────
# Leave EMPTY on HuggingFace Spaces — frontend and backend share one URL
# Set to http://localhost:7860 for local development if needed
API_BASE=

# ── Security ─────────────────────────────────────────────────
# Used for future JWT-protected endpoints — set to any long random string
JWT_SECRET=change-me-to-a-long-random-secret-string
```

### Variable guide

| Variable | Required | Example | Notes |
|---|---|---|---|
| `MONGO_URI` | ✅ Yes | `mongodb+srv://...` | MongoDB Atlas free tier works fine |
| `GOOGLE_CLIENT_ID` | ✅ Yes | `1234...apps.googleusercontent.com` | Enables Google Sign-In |
| `ADMIN_EMAILS` | ✅ Yes | `a@gmail.com,b@gmail.com` | Comma-separated, no spaces |
| `API_BASE` | ✅ Yes | ` ` (empty) | Empty = same-origin. Use `http://localhost:7860` locally |
| `JWT_SECRET` | Optional | `my-secret-abc123` | Set it anyway for future use |

---

## 🚀 Local Development Setup

### Prerequisites

- Python 3.11+
- A free [MongoDB Atlas](https://cloud.mongodb.com) account
- A [Google Cloud](https://console.cloud.google.com) project with OAuth credentials

### Step 1 — Clone and install

```bash
git clone https://github.com/your-username/careernest.git
cd careernest

python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt
```

### Step 2 — Set up MongoDB Atlas

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) and create a free cluster
2. Under **Database Access**, create a user with read/write permissions
3. Under **Network Access**, add `0.0.0.0/0` to allow connections from anywhere
4. Click **Connect → Drivers** and copy your connection string
5. Replace `<password>` in the string with your database user's password

### Step 3 — Set up Google OAuth

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Navigate to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Under **Authorized JavaScript origins**, add:
   - `http://localhost:7860`
   - `http://localhost:8000`
6. Copy the **Client ID**

### Step 4 — Create your `.env` file

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```dotenv
MONGO_URI=mongodb+srv://myuser:mypassword@cluster0.xxxxx.mongodb.net/careernest?retryWrites=true&w=majority
GOOGLE_CLIENT_ID=175096449908-xxxxxxxx.apps.googleusercontent.com
ADMIN_EMAILS=your@gmail.com
API_BASE=
JWT_SECRET=some-random-long-string
```

### Step 5 — Run the server

```bash
uvicorn main:app --reload --port 7860
```

Open your browser:

| URL | Page |
|---|---|
| `http://localhost:7860` | Student job board |
| `http://localhost:7860/admin` | Admin panel |
| `http://localhost:7860/docs` | Interactive API docs (Swagger) |
| `http://localhost:7860/health` | API health check |

On first start, the database is automatically seeded with 3 sample companies and 4 job listings.

---

## 🐳 Docker (Local)

```bash
# Build
docker build -t careernest .

# Run — pass your env vars directly
docker run -p 7860:7860 \
  -e MONGO_URI="mongodb+srv://..." \
  -e GOOGLE_CLIENT_ID="your-client-id" \
  -e ADMIN_EMAILS="you@gmail.com" \
  -e API_BASE="" \
  -e JWT_SECRET="your-secret" \
  careernest
```

Or use a `.env` file with Docker:

```bash
docker run -p 7860:7860 --env-file .env careernest
```

---

## ☁️ Deploy to HuggingFace Spaces

HuggingFace Spaces is the recommended free hosting for this project — it supports Docker, gives you a public URL, and has a built-in secrets manager so you never expose credentials.

### Step 1 — Create a Space

1. Go to [huggingface.co/new-space](https://huggingface.co/new-space)
2. Choose **Docker** as the SDK
3. Set visibility to **Public** or **Private**
4. Create the Space

### Step 2 — Add your secrets

Go to your Space → **Settings → Variables and secrets** and add each of these as a **Secret**:

| Secret Name | Value |
|---|---|
| `MONGO_URI` | Your full MongoDB Atlas connection string |
| `GOOGLE_CLIENT_ID` | Your Google OAuth Client ID |
| `ADMIN_EMAILS` | `you@gmail.com,other@gmail.com` |
| `API_BASE` | *(leave empty)* |
| `JWT_SECRET` | Any long random string |

> ⚠️ Use **Secrets** (not Variables) for `MONGO_URI`, `GOOGLE_CLIENT_ID`, and `JWT_SECRET` — Secrets are encrypted and hidden from logs.

### Step 3 — Add your HF Space URL to Google OAuth

1. Go back to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Edit your OAuth 2.0 Client ID
3. Add your Space URL to **Authorized JavaScript origins**:
   ```
   https://your-username-careernest.hf.space
   ```
4. Save

### Step 4 — Push your code

```bash
# Add HuggingFace as a remote
git remote add hf https://huggingface.co/spaces/your-username/careernest

# Make sure .env and config.js are in .gitignore
echo ".env" >> .gitignore
echo "config.js" >> .gitignore

# Push — HF will build and deploy automatically
git push hf main
```

Your Space will build (takes ~2 minutes) and be live at:
`https://your-username-careernest.hf.space`

---

## 📡 API Reference

The full interactive API docs are available at `/docs` once the server is running.

### Key endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server status and counts |
| `GET` | `/config.js` | Frontend config (generated from env vars) |
| `GET` | `/jobs` | List jobs with filters & pagination |
| `POST` | `/jobs` | Create a job listing |
| `GET` | `/jobs/{id}` | Get a single job |
| `PATCH` | `/jobs/{id}` | Update a job |
| `DELETE` | `/jobs/{id}` | Delete a job |
| `GET` | `/companies` | List all companies |
| `POST` | `/companies` | Register a company |
| `POST` | `/applications` | Submit an application |
| `GET` | `/students/{email}/applications` | Get a student's applications |
| `PATCH` | `/applications/{id}/status` | Update application status |
| `POST` | `/bookmarks` | Bookmark a job |
| `DELETE` | `/bookmarks` | Remove a bookmark |
| `GET` | `/students/{email}/bookmarks` | Get a student's bookmarks |
| `GET` | `/stats` | Platform-wide stats and breakdowns |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | [FastAPI](https://fastapi.tiangolo.com/) |
| Database | [MongoDB Atlas](https://cloud.mongodb.com) via [PyMongo](https://pymongo.readthedocs.io/) |
| Auth | [Google Identity Services](https://developers.google.com/identity) (OAuth 2.0 / JWT) |
| Frontend | Vanilla HTML, CSS, JavaScript (no framework) |
| Deployment | [HuggingFace Spaces](https://huggingface.co/spaces) (Docker) |
| Fonts | Google Fonts — Playfair Display + DM Sans |

---

## 🔒 Security Notes

- **`config.js` is generated at runtime** from environment variables — never committed to the repo
- **Admin panel** is protected by Google OAuth; only emails listed in `ADMIN_EMAILS` can access it
- **MongoDB credentials** should always be stored as HuggingFace Secrets, never in the repo
- **CORS** is set to `allow_origins=["*"]` — tighten this to your domain in production
- Add `.env` and `config.js` to your `.gitignore` to prevent accidental commits:
  ```
  .env
  config.js
  __pycache__/
  *.pyc
  ```

---

## 🌱 Seed Data

On first startup, if the database is empty, `seed.py` automatically inserts:

- **3 companies** — TechNova Solutions, FinEdge Capital, DesignPulse Agency
- **4 job listings** — Backend Intern, Full Stack Developer, Finance Intern, UI/UX Design Intern

To reset and re-seed: drop the `careernest` database in MongoDB Atlas and restart the server.

---

## 👥 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Push and open a Pull Request

---

*Built with ❤️ for students and campus placement cells.*