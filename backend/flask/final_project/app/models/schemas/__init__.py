"""Marshmallow schemas for validation and serialization."""

from app.models.schemas.auth_schema import AuthInputSchema
from app.models.schemas.config_schema import ConfigSchema
from app.models.schemas.create_sensor_schema import CreateSensorSchema
from app.models.schemas.sensor_response_schema import SensorResponseSchema
from app.models.schemas.telemetry_schema import (
    TelemetryInputSchema,
    TelemetryResponseSchema,
)

__all__ = [
    "AuthInputSchema",
    "ConfigSchema",
    "CreateSensorSchema",
    "SensorResponseSchema",
    "TelemetryInputSchema",
    "TelemetryResponseSchema",
]
