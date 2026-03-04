# ─────────────────────────────────────────────────────────────
# CareerNest — HuggingFace Spaces Dockerfile
#
# ✅ No config.js needed — all frontend config is served
#    dynamically from environment variables via GET /config.js
#
# HuggingFace Spaces requirements:
#   • Port MUST be 7860
#   • Set MONGO_URI, GOOGLE_CLIENT_ID, ADMIN_EMAILS, API_BASE
#     as Repository Secrets (Settings → Variables and secrets)
# ─────────────────────────────────────────────────────────────
FROM python:3.11-slim

ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /home/user/app

# ── 1. Install Python dependencies (cached layer) ────────
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# ── 2. Copy Python source ─────────────────────────────────
COPY main.py       .
COPY database.py   .
COPY models.py     .
COPY utils.py      .
COPY seed.py       .
COPY routers/      ./routers/

# ── 3. Copy frontend HTML & static assets ─────────────────
#    NOTE: config.js is intentionally NOT copied.
#          It is generated at runtime from env vars via /config.js
COPY index.html    .
COPY admin.html    .
COPY static/       ./static/

# ── 4. HuggingFace Spaces requires port 7860 ─────────────
EXPOSE 7860

# ── 5. Start server ───────────────────────────────────────
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]