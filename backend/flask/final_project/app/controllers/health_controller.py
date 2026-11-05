"""
HTTP layer for health checks (Flask Blueprint), used by Kubernetes probes.

- ``GET /health`` — liveness: the process answers HTTP. Never touches the
  database, so a slow or unavailable PostgreSQL does not make Kubernetes
  restart every backend pod in cascade.
- ``GET /health/ready`` — readiness: the pod can serve traffic, i.e. it can
  reach the database. While it fails, the pod is removed from the Service
  endpoints but is not restarted.
"""

from __future__ import annotations

from flask import Blueprint, Response, jsonify
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db

health_bp = Blueprint("health", __name__)


@health_bp.route("", methods=["GET"])
def liveness() -> tuple[Response, int]:
    """
    Liveness probe
    ---
    tags:
      - health
    responses:
      200:
        description: The process is alive
    """
    return jsonify({"status": "ok"}), 200


@health_bp.route("/ready", methods=["GET"])
def readiness() -> tuple[Response, int]:
    """
    Readiness probe (checks the database connection)
    ---
    tags:
      - health
    responses:
      200:
        description: Ready to receive traffic
      503:
        description: Database unreachable
    """
    try:
        db.session.execute(text("SELECT 1"))
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"status": "unavailable", "database": "down"}), 503
    return jsonify({"status": "ok", "database": "up"}), 200
