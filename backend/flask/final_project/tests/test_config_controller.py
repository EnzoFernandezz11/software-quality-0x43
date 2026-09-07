"""Tests for GET/PUT /api/config endpoints."""

import json


class TestConfigGet:
    def test_get_returns_200(self, client):
        response = client.get("/api/config")
        assert response.status_code == 200
        data = response.get_json()
        assert "room_name" in data
        assert "base_temp_limit" in data
        assert "inertia_time_minutes" in data
        assert "target_temperature" in data
        assert "current_mode" in data


class TestConfigPut:
    def test_update_config(self, client):
        payload = {
            "room_name": "Meeting Room A",
            "base_temp_limit": 22.0,
            "inertia_time_minutes": 10,
            "target_temperature": 25.0,
            "current_mode": "Meeting",
        }
        response = client.put(
            "/api/config",
            data=json.dumps(payload),
            content_type="application/json",
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["status"] == "success"
        assert data["config"]["base_temp_limit"] == 22.0

    def test_invalid_temp_range(self, client):
        payload = {
            "room_name": "Room",
            "base_temp_limit": 100.0,  # out of range (15-30)
            "inertia_time_minutes": 15,
            "target_temperature": 24.0,
            "current_mode": "Normal",
        }
        response = client.put(
            "/api/config",
            data=json.dumps(payload),
            content_type="application/json",
        )
        assert response.status_code == 400

    def test_invalid_mode(self, client):
        payload = {
            "room_name": "Room",
            "base_temp_limit": 21.0,
            "inertia_time_minutes": 15,
            "target_temperature": 24.0,
            "current_mode": "InvalidMode",
        }
        response = client.put(
            "/api/config",
            data=json.dumps(payload),
            content_type="application/json",
        )
        assert response.status_code == 400
