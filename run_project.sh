#!/bin/bash
# sof-eng-2026-grupo-nueve startup script for Linux/macOS
# Aligned with course guidelines and best practices

echo "====================================================================="
echo "   STARTING DOCKER DEVELOPMENT ENVIRONMENT: ALL SERVICES"
echo "====================================================================="
echo

# 1. Copy .env.example to .env if it does not exist
if [ ! -f .env ]; then
    echo "[INFO] .env file not found. Creating it from .env.example..."
    cp .env.example .env
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to copy .env.example to .env"
        exit 1
    fi
    echo "[OK] Created .env file."
else
    echo "[INFO] .env file found."
fi

# 2. Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker is not installed or not in PATH."
    echo "Please install Docker and try again."
    exit 1
fi

# 3. Start Database, Backend, Frontend and pgAdmin in Docker
echo "[INFO] Starting PostgreSQL, Flask, Next.js, and pgAdmin in Docker..."
echo "[INFO] This will build/update the images and start all services."
echo "[INFO] Press Ctrl+C in this terminal to stop all containers."
echo

cd docker
docker compose up --build
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to run docker compose."
    cd ..
    exit 1
fi
cd ..

echo
echo "[INFO] Development environment stopped."
