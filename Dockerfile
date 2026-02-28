# ────────────────────────────────────────────────
# CareerNest — HuggingFace Spaces Dockerfile
# ────────────────────────────────────────────────
FROM python:3.11-slim

# HF Spaces runs as a non-root user; set a safe home dir
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /home/user/app

# Install dependencies first (layer-cached unless requirements change)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# Copy ALL application files including .env
COPY .env          .
COPY main.py       .
COPY index.html    .
COPY admin.html    .
COPY config.js     .

# HuggingFace Spaces REQUIRES port 7860
EXPOSE 7860

# Start the server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]