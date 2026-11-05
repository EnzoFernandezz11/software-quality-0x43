# syntax=docker/dockerfile:1
#
# Image for the Flask API (`backend/flask/final_project`).
# Build from the repository root:
#
#   docker build -f docker/flask.Dockerfile -t soft-eng-flask .
#
# Only the Flask project is copied into the image (not the whole monorepo) and
# the process runs as a non-root user.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app/backend/flask/final_project

# Copy only requirements first to leverage the layer cache
COPY backend/flask/final_project/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/flask/final_project/ ./

# The code stays owned by root (read-only for the app user).
RUN useradd --system --uid 1001 --no-create-home flask
USER flask

ENV FLASK_APP=main:app
ENV FLASK_PORT=5000

EXPOSE 5000

# Default for Docker Compose (development server). Kubernetes overrides the
# command and serves the app with gunicorn (see tp-k8s/k8s/30-back.yaml).
CMD ["sh", "-c", "flask db upgrade && python main.py"]
