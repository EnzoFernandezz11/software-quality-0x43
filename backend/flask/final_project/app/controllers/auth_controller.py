"""
HTTP layer for ``POST /api/auth/validate`` (Flask Blueprint).

Validates a keypad PIN via the AuthenticationService (Strategy + Observer).
"""

from __future__ import annotations

from flask import Blueprint, Response, jsonify, request
from marshmallow import ValidationError

from app.models.schemas.auth_schema import AuthInputSchema
from app.repositories.config_repository import ConfigRepository
from app.services.auth_service import (
    AuthenticationService,
    SecurityAuditor,
    SystemAlerter,
)
from app.services.auth_strategies import AuthStrategyFactory

auth_bp = Blueprint("auth", __name__)

_input_schema = AuthInputSchema()


def _build_auth_service(strategy_name: str | None = None) -> AuthenticationService:
    """Build the authentication service with observers wired."""
    strategy = AuthStrategyFactory.get_strategy(strategy_name)
    service = AuthenticationService(strategy=strategy)
    service.subscribe(SecurityAuditor())
    service.subscribe(SystemAlerter())
    return service


@auth_bp.route("/validate", methods=["POST"])
def validate_pin() -> tuple[Response, int]:
    """
    Validate a keypad PIN
    ---
    tags:
      - auth
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - pin
          properties:
            pin:
              type: string
    responses:
      200:
        description: PIN validated successfully
      400:
        description: Invalid PIN format
      401:
        description: Invalid credentials
    """
    if not request.is_json:
        return jsonify({"status": "error", "message": "Expected application/json"}), 400

    body = request.get_json(silent=True)
    if body is None:
        return jsonify({"status": "error", "message": "Invalid JSON body"}), 400

    try:
        payload = _input_schema.load(body)
    except ValidationError:
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "PIN must be a 4-digit numeric string.",
                }
            ),
            400,
        )

    auth_service = _build_auth_service(payload.get("strategy"))
    success = auth_service.authenticate(payload["pin"])

    if success:
        config_repo = ConfigRepository()
        config = config_repo.get_or_create()
        # Cycle mode on successful auth
        mode_cycle = {
            "Normal": "Meeting",
            "Meeting": "Energy Saving",
            "Energy Saving": "Normal",
        }
        new_mode = mode_cycle.get(config.current_mode, "Meeting")
        config_repo.update({"current_mode": new_mode})

        return (
            jsonify(
                {
                    "authenticated": True,
                    "current_mode": new_mode,
                    "message": f"Access granted, mode updated to {new_mode}",
                }
            ),
            200,
        )

    return (
        jsonify(
            {
                "authenticated": False,
                "message": "Invalid credentials",
            }
        ),
        401,
    )
