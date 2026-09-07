# syntax=docker/dockerfile:1
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies if any are needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy only requirements first to leverage caching
COPY backend/flask/final_project/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire workspace (context is repo root)
# .dockerignore will keep this context small
COPY . /app

# Move to the flask project directory
WORKDIR /app/backend/flask/final_project

# Set default env variables (can be overridden by docker-compose)
ENV FLASK_APP=main:app
ENV FLASK_PORT=5000

EXPOSE 5000

# Run migrations and then start the server
CMD ["sh", "-c", "flask db upgrade && python main.py"]
