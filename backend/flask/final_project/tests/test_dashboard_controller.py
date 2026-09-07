"""Tests for GET /api/dashboard/* endpoints."""

import json


class TestDashboardLive:
    def test_live_returns_200(self, client):
        response = client.get("/api/dashboard/live")
        assert response.status_code == 200
        data = response.get_json()
        assert "last_reading" in data
        assert "room_status" in data
        assert "current_mode" in data["room_status"]
        assert "target_temperature" in data["room_status"]


class TestDashboardHistory:
    def test_history_returns_200(self, client):
        response = client.get("/api/dashboard/history")
        assert response.status_code == 200
        data = response.get_json()
        assert "total" in data
        assert "readings" in data
        assert isinstance(data["readings"], list)

    def test_history_respects_limit(self, client):
        # Ingest a few readings first
        for i in range(5):
            client.post(
                "/api/telemetry",
                data=json.dumps(
                    {
                        "sensor_id": f"esp32-{i}",
                        "raw_temperature": 20.0 + i,
                        "motion_detected": False,
                    }
                ),
                content_type="application/json",
            )

        response = client.get("/api/dashboard/history?limit=2&offset=0")
        assert response.status_code == 200
        data = response.get_json()
        assert len(data["readings"]) <= 2


class TestDashboardSecurityLogs:
    def test_security_logs_returns_200(self, client):
        response = client.get("/api/dashboard/security-logs")
        assert response.status_code == 200
        data = response.get_json()
        assert "logs" in data
        assert isinstance(data["logs"], list)

    def test_logs_mask_pin(self, client):
        # Create a security event first
        client.post(
            "/api/auth/validate",
            data=json.dumps({"pin": "1234"}),
            content_type="application/json",
        )
        response = client.get("/api/dashboard/security-logs")
        data = response.get_json()
        if data["logs"]:
            assert data["logs"][0]["pin_entered"] == "****"
