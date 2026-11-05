"""Tests for GET /health and GET /health/ready (Kubernetes probes)."""

from unittest.mock import patch

from sqlalchemy.exc import OperationalError


class TestLiveness:
    def test_liveness_returns_200(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.get_json() == {"status": "ok"}

    def test_liveness_does_not_touch_database(self, client):
        with patch("app.controllers.health_controller.db.session.execute") as execute:
            response = client.get("/health")
        assert response.status_code == 200
        execute.assert_not_called()


class TestConnectionPool:
    def test_pool_pre_ping_enabled(self, app):
        # Avoids 500s from stale pooled connections after a database restart.
        assert app.config["SQLALCHEMY_ENGINE_OPTIONS"]["pool_pre_ping"] is True


class TestReadiness:
    def test_readiness_returns_200_when_database_is_up(self, client):
        response = client.get("/health/ready")
        assert response.status_code == 200
        assert response.get_json() == {"status": "ok", "database": "up"}

    def test_readiness_returns_503_when_database_is_down(self, client):
        error = OperationalError("SELECT 1", {}, Exception("connection refused"))
        with patch(
            "app.controllers.health_controller.db.session.execute", side_effect=error
        ):
            response = client.get("/health/ready")
        assert response.status_code == 503
        assert response.get_json()["database"] == "down"
