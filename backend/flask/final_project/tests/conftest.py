"""
Pytest fixtures for the Smart Office Flask backend.

Uses SQLite in-memory so tests run without Docker/PostgreSQL.
"""

import pytest

from app import create_app
from app.extensions import db as _db
from app.models.entities.room_config import RoomConfig


@pytest.fixture(scope="session")
def app():
    """Create a Flask app configured for testing with SQLite in-memory."""
    test_config = {
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "SQLALCHEMY_TRACK_MODIFICATIONS": False,
    }
    _app = create_app(config_overrides=test_config)

    with _app.app_context():
        _db.create_all()
        # Seed default room config
        if not RoomConfig.query.first():
            _db.session.add(RoomConfig())
            _db.session.commit()

    yield _app

    with _app.app_context():
        _db.drop_all()


@pytest.fixture()
def client(app):
    """Flask test client."""
    return app.test_client()


@pytest.fixture(autouse=True)
def clean_db(app):
    """Roll back the session after each test to keep tests isolated."""
    with app.app_context():
        yield
        _db.session.rollback()
