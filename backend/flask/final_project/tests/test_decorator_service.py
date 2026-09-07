"""Tests for the Decorator pattern (telemetry enrichment)."""

from app.services.decorator_service import (
    BaseTelemetry,
    SensorMetadataDecorator,
)


class TestBaseTelemetry:
    def test_extracts_core_fields(self):
        raw = {
            "sensor_id": "esp32-1",
            "raw_temperature": 24.5,
            "motion_detected": True,
            "extra_field": "should be ignored",
        }
        result = BaseTelemetry().get_decorated_data(raw)
        assert result == {
            "sensor_id": "esp32-1",
            "raw_temperature": 24.5,
            "motion_detected": True,
        }


class TestSensorMetadataDecorator:
    def test_adds_metadata(self):
        raw = {
            "sensor_id": "esp32-1",
            "raw_temperature": 24.5,
            "motion_detected": True,
        }
        base = BaseTelemetry()
        decorated = SensorMetadataDecorator(base, "Meeting Room A", False)
        result = decorated.get_decorated_data(raw)

        assert result["sensor_id"] == "esp32-1"
        assert result["room_location"] == "Meeting Room A"
        assert result["thermal_alert_status"] is False

    def test_stacking_decorators(self):
        raw = {
            "sensor_id": "esp32-1",
            "raw_temperature": 24.5,
            "motion_detected": True,
        }
        base = BaseTelemetry()
        first = SensorMetadataDecorator(base, "Room A", False)
        second = SensorMetadataDecorator(first, "Room B", True)
        result = second.get_decorated_data(raw)

        # The second decorator overwrites the first's metadata
        assert result["room_location"] == "Room B"
        assert result["thermal_alert_status"] is True
