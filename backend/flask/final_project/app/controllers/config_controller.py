"""
HTTP layer for ``GET/PUT /api/config`` (Flask Blueprint).

Manages room configuration thresholds used by the processing algorithms
and the frontend settings panel.
"""

from __future__ import annotations

from flask import Blueprint, Response, jsonify, request
from marshmallow import ValidationError

from app.models.schemas.config_schema import ConfigSchema
from app.repositories.config_repository import ConfigRepository

config_bp = Blueprint("config", __name__)

_schema = ConfigSchema()


def _serialize_config(config) -> dict:
    return {
        "room_name": config.room_name,
        "base_temp_limit": config.base_temp_limit,
        "inertia_time_minutes": config.inertia_time_minutes,
        "target_temperature": config.target_temperature,
        "current_mode": config.current_mode,
    }


@config_bp.route("", methods=["GET"])
def get_config() -> tuple[Response, int]:
    """
    Get room configuration
    ---
    tags:
      - config
    responses:
      200:
        description: Current room configuration
    """
    config_repo = ConfigRepository()
    config = config_repo.get_or_create()
    return jsonify(_serialize_config(config)), 200


@config_bp.route("", methods=["PUT"])
def update_config() -> tuple[Response, int]:
    """
    Update room configuration
    ---
    tags:
      - config
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            room_name:
              type: string
            base_temp_limit:
              type: number
            inertia_time_minutes:
              type: integer
            target_temperature:
              type: number
            current_mode:
              type: string
    responses:
      200:
        description: Configuration updated
      400:
        description: Validation error
    """
    if not request.is_json:
        return jsonify({"status": "error", "message": "Expected application/json"}), 400

    body = request.get_json(silent=True)
    if body is None:
        return jsonify({"status": "error", "message": "Invalid JSON body"}), 400

    try:
        payload = _schema.load(body)
    except ValidationError as err:
        first_error = next(iter(err.messages.values()))[0]
        return (
            jsonify(
                {
                    "status": "error",
                    "message": f"Validation failed: {first_error}",
                }
            ),
            400,
        )

    config_repo = ConfigRepository()
    updated = config_repo.update(payload)

    return (
        jsonify(
            {
                "status": "success",
                "message": "Configuration updated successfully",
                "config": _serialize_config(updated),
            }
        ),
        200,
    )
