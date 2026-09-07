"""Tests for POST /api/telemetry endpoint."""

import json


class TestTelemetryEndpoint:
    def test_valid_telemetry(self, client):
        payload = {
            "sensor_id": "esp32-office-1",
            "raw_temperature": 24.5,
            "motion_detected": True,
        }
        response = client.post(
            "/api/telemetry",
            data=json.dumps(payload),
            content_type="application/json",
        )
        assert response.status_code == 201
        data = response.get_json()
        assert data["status"] == "success"
        assert data["data"]["sensor_id"] == "esp32-office-1"
        assert "filtered_temperature" in data["data"]
        assert "thermal_alert_status" in data["data"]
        assert "room_location" in data["data"]

    def test_missing_field_returns_400(self, client):
        payload = {"sensor_id": "esp32-1"}  # missing raw_temperature and motion
        response = client.post(
            "/api/telemetry",
            data=json.dumps(payload),
            content_type="application/json",
        )
        assert response.status_code == 400
        data = response.get_json()
        assert data["status"] == "error"

    def test_invalid_content_type(self, client):
        response = client.post("/api/telemetry", data="not json")
        assert response.status_code == 400

    def test_invalid_temperature_type(self, client):
        payload = {
            "sensor_id": "esp32-1",
            "raw_temperature": "not-a-number",
            "motion_detected": True,
        }
        response = client.post(
            "/api/telemetry",
            data=json.dumps(payload),
            content_type="application/json",
        )
        assert response.status_code == 400
