"""
HTTP layer for ``POST /api/telemetry`` (Flask Blueprint).

Receives ESP32 sensor payloads, applies the full processing pipeline:
1. Validate input (Marshmallow).
2. Apply Moving Median filter.
3. Detect Thermal Inertia.
4. Decorate with metadata (Decorator pattern).
5. Persist to PostgreSQL.
6. Notify LiveMetricsSubject (Observer pattern).
"""

from __future__ import annotations

from flask import Blueprint, Response, jsonify, request
from marshmallow import ValidationError

from app.models.schemas.telemetry_schema import (
    TelemetryInputSchema,
    TelemetryResponseSchema,
)
from app.repositories.config_repository import ConfigRepository
from app.repositories.sensors_repository import SensorsRepository
from app.services.decorator_service import BaseTelemetry, SensorMetadataDecorator
from app.services.processing_service import (
    apply_moving_median,
    detect_thermal_inertia,
)

telemetry_bp = Blueprint("telemetry", __name__)

_input_schema = TelemetryInputSchema()
_response_schema = TelemetryResponseSchema()


@telemetry_bp.route("", methods=["POST"])
def ingest_telemetry() -> tuple[Response, int]:
    """
    Ingest a sensor reading from ESP32
    ---
    tags:
      - telemetry
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - sensor_id
            - raw_temperature
            - motion_detected
          properties:
            sensor_id:
              type: string
            raw_temperature:
              type: number
            motion_detected:
              type: boolean
    responses:
      201:
        description: Telemetry ingested successfully
      400:
        description: Validation error
    """
    if not request.is_json:
        return jsonify({"status": "error", "message": "Expected application/json"}), 400

    body = request.get_json(silent=True)
    if body is None:
        return jsonify({"status": "error", "message": "Invalid JSON body"}), 400

    try:
        payload = _input_schema.load(body)
    except ValidationError as err:
        first_error = next(iter(err.messages.values()))[0]
        return (
            jsonify(
                {"status": "error", "message": f"Validation failed: {first_error}"}
            ),
            400,
        )

    sensors_repo = SensorsRepository()
    config_repo = ConfigRepository()

    # 1. Moving Median filter
    recent_temps = sensors_repo.find_recent_temps(n=5)
    filtered_temp = apply_moving_median(recent_temps, payload["raw_temperature"])

    # 2. Thermal Inertia detection
    config = config_repo.get_or_create()
    recent_readings = sensors_repo.find_recent_with_motion(
        minutes=config.inertia_time_minutes
    )
    has_alert = detect_thermal_inertia(recent_readings, config.inertia_time_minutes)

    # 3. Decorator pattern — enrich raw data with metadata
    base = BaseTelemetry()
    decorated = SensorMetadataDecorator(base, config.room_name, has_alert)
    enriched = decorated.get_decorated_data(payload)
    enriched["filtered_temperature"] = filtered_temp

    # 4. Persist
    saved = sensors_repo.save(enriched)

    # 5. Notify observers (Observer pattern)
    from flask import current_app
    subject = current_app.config.get("LIVE_METRICS_SUBJECT")
    if subject:
        subject.notify(_response_schema.dump(saved))

    return (
        jsonify(
            {
                "status": "success",
                "data": _response_schema.dump(saved),
            }
        ),
        201,
    )
