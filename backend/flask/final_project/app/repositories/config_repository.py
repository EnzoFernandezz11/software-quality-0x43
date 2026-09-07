"""
PostgreSQL access for room configuration (Flask-SQLAlchemy).

Provides ``get_or_create`` to ensure a default config always exists and
``update`` to persist dashboard configuration changes.
"""

from __future__ import annotations

from typing import Any

from app.extensions import db
from app.models.entities.room_config import RoomConfig


class ConfigRepository:
    def get_or_create(self) -> RoomConfig:
        """Return the first room config, creating one with defaults if none exists."""
        config = RoomConfig.query.first()
        if config is None:
            config = RoomConfig()
            db.session.add(config)
            db.session.commit()
            db.session.refresh(config)
        return config

    def update(self, data: dict[str, Any]) -> RoomConfig:
        """Update the room config with the given data dict."""
        config = self.get_or_create()
        for key, value in data.items():
            if hasattr(config, key):
                setattr(config, key, value)
        db.session.commit()
        db.session.refresh(config)
        return config
