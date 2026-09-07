"""
Decorator pattern for telemetry enrichment.

Wraps raw LM35/PIR data with server-side metadata (room location, thermal
alert status) before persistence.

``BaseTelemetry`` extracts the core fields; ``SensorMetadataDecorator``
layers additional context on top without modifying the original component.
"""

from __future__ import annotations

from typing import Any


class TelemetryComponent:
    """Interface for telemetry data components."""

    def get_decorated_data(self, raw_data: dict[str, Any]) -> dict[str, Any]:
        return raw_data


class BaseTelemetry(TelemetryComponent):
    """Extracts core sensor fields from the raw ESP32 payload."""

    def get_decorated_data(self, raw_data: dict[str, Any]) -> dict[str, Any]:
        return {
            "sensor_id": raw_data["sensor_id"],
            "raw_temperature": raw_data["raw_temperature"],
            "motion_detected": raw_data["motion_detected"],
        }


class SensorMetadataDecorator(TelemetryComponent):
    """Adds server-side metadata: room location and thermal alert status."""

    def __init__(
        self,
        component: TelemetryComponent,
        location: str,
        has_alert: bool,
    ) -> None:
        self._component = component
        self._location = location
        self._has_alert = has_alert

    def get_decorated_data(self, raw_data: dict[str, Any]) -> dict[str, Any]:
        data = self._component.get_decorated_data(raw_data)
        data.update(
            {
                "room_location": self._location,
                "thermal_alert_status": self._has_alert,
            }
        )
        return data
