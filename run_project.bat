@echo off
:: sof-eng-2026-grupo-nueve startup script for Windows (Database + Flask + Frontend + pgAdmin in Docker)
:: Aligned with course guidelines and best practices

title sof-eng-2026-grupo-nueve - Start Docker Environment

echo =====================================================================
echo    STARTING DOCKER DEVELOPMENT ENVIRONMENT: ALL SERVICES
echo =====================================================================
echo.

:: 1. Copy .env.example to .env if it does not exist
if not exist .env (
    echo [INFO] .env file not found. Creating it from .env.example...
    copy .env.example .env >nul
    if errorlevel 1 (
        echo [ERROR] Failed to copy .env.example to .env
        exit /b 1
    )
    echo [OK] Created .env file.
) else (
    echo [INFO] .env file found.
)

:: 2. Check if Docker is installed and running
where docker >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Docker is not installed or not in PATH.
    echo Please install Docker Desktop and try again.
    pause
    exit /b 1
)

:: 3. Start Database, Backend, Frontend and pgAdmin in Docker
echo [INFO] Starting PostgreSQL, Flask, Next.js, and pgAdmin in Docker...
echo [INFO] This will build/update the images and start all services.
echo [INFO] Press Ctrl+C in this window to stop all containers.
echo.

cd docker
docker compose up --build
if errorlevel 1 (
    echo [ERROR] Failed to run docker compose. Make sure Docker Desktop is running.
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo [INFO] Development environment stopped.
pause
