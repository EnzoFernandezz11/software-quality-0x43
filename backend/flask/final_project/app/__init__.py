"""
Flask application factory.

``create_app`` wires SQLAlchemy, Flask-Migrate, CORS, and Flasgger, registers
the sensors blueprint, and loads configuration from the **monorepo root**
``.env`` (shared with Docker / other backends). No route implementations belong
here — only extension setup and registration.
"""

from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv
from flasgger import Swagger
from flask import Flask
from flask_cors import CORS

from app.extensions import db, migrate


def _monorepo_root() -> Path:
    # app/__init__.py -> app -> final_project -> flask -> backend -> repo root
    return Path(__file__).resolve().parents[4]


def _sqlalchemy_database_uri() -> str:
    raw = os.getenv("DATABASE_URL", "").strip()
    if raw and not raw.startswith("postgresql://${"):
        return raw

    user = quote_plus(os.getenv("POSTGRES_USER", "postgres"))
    password = quote_plus(os.getenv("POSTGRES_PASSWORD", ""))
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    name = os.getenv("POSTGRES_DB", "postgres")
    return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{name}"


def create_app(config_overrides: dict | None = None) -> Flask:
    load_dotenv(_monorepo_root() / ".env", override=False)

    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = _sqlalchemy_database_uri()
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "dev-change-me")

    # Allow test overrides (e.g. SQLite in-memory for pytest)
    if config_overrides:
        app.config.update(config_overrides)

    db.init_app(app)
    migrate.init_app(app, db)

    # Register all entity models so Alembic detects them for migrations.
    with app.app_context():
        from app.models.entities.access_audit import AccessAudit  # noqa: F401
        from app.models.entities.room_config import RoomConfig  # noqa: F401
        from app.models.entities.sensor_reading import SensorReading  # noqa: F401

    CORS(app)

    # -- Swagger docs --------------------------------------------------------
    swagger_template = {
        "swagger": "2.0",
        "info": {
            "title": "Smart Office IoT API (Flask)",
            "description": "REST API for the Smart Office thermal efficiency system.",
            "version": "1.0.0",
        },
        "basePath": "/",
    }
    Swagger(app, template=swagger_template)

    # -- Observer infrastructure ---------------------------------------------
    from app.services.live_metrics_service import (
        CacheMetricsUpdater,
        LiveConsoleLogger,
        LiveMetricsSubject,
    )

    subject = LiveMetricsSubject()
    cache_updater = CacheMetricsUpdater()
    subject.subscribe(cache_updater)
    subject.subscribe(LiveConsoleLogger())

    app.config["LIVE_METRICS_SUBJECT"] = subject
    app.config["CACHE_METRICS_UPDATER"] = cache_updater

    # -- Register blueprints -------------------------------------------------
    from app.controllers.auth_controller import auth_bp
    from app.controllers.config_controller import config_bp
    from app.controllers.dashboard_controller import dashboard_bp
    from app.controllers.telemetry_controller import telemetry_bp

    app.register_blueprint(telemetry_bp, url_prefix="/api/telemetry")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")
    app.register_blueprint(config_bp, url_prefix="/api/config")

    # Keep legacy sensors blueprint for backward compatibility
    from app.controllers.sensors_controller import sensors_bp

    app.register_blueprint(sensors_bp, url_prefix="/sensors")
    return app
def funcion_rompe_linter(