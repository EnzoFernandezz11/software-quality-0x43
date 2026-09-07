"""
HTTP layer for dashboard endpoints (Flask Blueprint).

- ``GET /api/dashboard/live`` — returns cached last reading + room status.
- ``GET /api/dashboard/history`` — paginated sensor history from PostgreSQL.
- ``GET /api/dashboard/security-logs`` — access audit log.
"""

from __future__ import annotations

from datetime import datetime

from flask import Blueprint, Response, current_app, jsonify, request

from app.models.schemas.telemetry_schema import TelemetryResponseSchema
from app.repositories.config_repository import ConfigRepository
from app.repositories.sensors_repository import SensorsRepository
from app.services.processing_service import calculate_base_sleep_temperature

dashboard_bp = Blueprint("dashboard", __name__)

_response_schema = TelemetryResponseSchema()


@dashboard_bp.route("/live", methods=["GET"])
def live_metrics() -> tuple[Response, int]:
    """
    Get live metrics for the dashboard
    ---
    tags:
      - dashboard
    responses:
      200:
        description: Current live metrics
    """
    cache_updater = current_app.config.get("CACHE_METRICS_UPDATER")

    last_reading = {}
    if cache_updater:
        last_reading = cache_updater.last_reading

    config_repo = ConfigRepository()
    config = config_repo.get_or_create()

    sensors_repo = SensorsRepository()
    no_motion_readings = sensors_repo.find_last_24h_no_motion()
    base_sleep_temp = calculate_base_sleep_temperature(no_motion_readings)

    return (
        jsonify(
            {
                "last_reading": last_reading,
                "room_status": {
                    "current_mode": config.current_mode,
                    "target_temperature": config.target_temperature,
                    "base_sleep_temperature": base_sleep_temp,
                },
            }
        ),
        200,
    )


@dashboard_bp.route("/history", methods=["GET"])
def history() -> tuple[Response, int]:
    """
    Get historical sensor readings (paginated)
    ---
    tags:
      - dashboard
    parameters:
      - name: limit
        in: query
        type: integer
        default: 50
      - name: offset
        in: query
        type: integer
        default: 0
      - name: start_date
        in: query
        type: string
        format: date-time
      - name: end_date
        in: query
        type: string
        format: date-time
    responses:
      200:
        description: Paginated readings
    """
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)

    start_date_str = request.args.get("start_date")
    end_date_str = request.args.get("end_date")

    start_date = None
    end_date = None

    if start_date_str:
        try:
            start_date = datetime.fromisoformat(start_date_str)
        except ValueError:
            pass

    if end_date_str:
        try:
            end_date = datetime.fromisoformat(end_date_str)
        except ValueError:
            pass

    sensors_repo = SensorsRepository()
    rows, total = sensors_repo.find_paginated(limit, offset, start_date, end_date)

    return (
        jsonify(
            {
                "total": total,
                "readings": _response_schema.dump(rows, many=True),
            }
        ),
        200,
    )


@dashboard_bp.route("/security-logs", methods=["GET"])
def security_logs() -> tuple[Response, int]:
    """
    Get access audit logs
    ---
    tags:
      - dashboard
    responses:
      200:
        description: Security audit logs
    """
    from app.repositories.auth_repository import AuthRepository

    auth_repo = AuthRepository()
    logs = auth_repo.find_all()

    return (
        jsonify(
            {
                "logs": [
                    {
                        "id": log.id,
                        "pin_entered": "****",
                        "is_success": log.is_success,
                        "strategy_used": log.strategy_used,
                        "created_at": (
                            log.created_at.isoformat() if log.created_at else None
                        ),
                    }
                    for log in logs
                ],
            }
        ),
        200,
    )
