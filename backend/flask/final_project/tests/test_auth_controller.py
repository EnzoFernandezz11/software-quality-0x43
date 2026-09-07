"""Tests for POST /api/auth/validate endpoint."""

import json


class TestAuthEndpoint:
    def test_valid_pin(self, client):
        response = client.post(
            "/api/auth/validate",
            data=json.dumps({"pin": "1234"}),
            content_type="application/json",
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["authenticated"] is True
        assert "current_mode" in data

    def test_invalid_pin(self, client):
        response = client.post(
            "/api/auth/validate",
            data=json.dumps({"pin": "0000"}),
            content_type="application/json",
        )
        assert response.status_code == 401
        data = response.get_json()
        assert data["authenticated"] is False

    def test_malformed_pin_too_short(self, client):
        response = client.post(
            "/api/auth/validate",
            data=json.dumps({"pin": "12"}),
            content_type="application/json",
        )
        assert response.status_code == 400
        data = response.get_json()
        assert data["status"] == "error"

    def test_non_numeric_pin(self, client):
        response = client.post(
            "/api/auth/validate",
            data=json.dumps({"pin": "abcd"}),
            content_type="application/json",
        )
        assert response.status_code == 400

    def test_missing_pin(self, client):
        response = client.post(
            "/api/auth/validate",
            data=json.dumps({}),
            content_type="application/json",
        )
        assert response.status_code == 400

    def test_external_strategy_success(self, client):
        response = client.post(
            "/api/auth/validate",
            data=json.dumps({"pin": "9999", "strategy": "ExternalApiAuthStrategy"}),
            content_type="application/json",
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["authenticated"] is True

    def test_external_strategy_fail_wrong_pin(self, client):
        response = client.post(
            "/api/auth/validate",
            data=json.dumps({"pin": "1234", "strategy": "ExternalApiAuthStrategy"}),
            content_type="application/json",
        )
        assert response.status_code == 401
        data = response.get_json()
        assert data["authenticated"] is False
