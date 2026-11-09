"""
PostgreSQL access for sensor readings (Flask-SQLAlchemy).

Provides query methods for the telemetry controller and processing algorithms:
- ``save`` — persists a decorated reading.
- ``find_all`` — returns newest-first history.
- ``find_recent_temps`` — last N filtered temperatures for the moving median.
- ``find_last_24h_no_motion`` — readings without motion for base sleep temp.
- ``find_recent_with_motion`` — recent readings with motion for inertia detection.
- ``find_paginated`` — paginated history with optional date filters.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any


from app.extensions import db
from app.models.entities.sensor_reading import SensorReading


class SensorsRepository:
    def save(self, data: dict[str, Any]) -> SensorReading:
        row = SensorReading(
            sensor_id=data["sensor_id"],
            raw_temperature=data["raw_temperature"],
            filtered_temperature=data["filtered_temperature"],
            motion_detected=data["motion_detected"],
            thermal_alert_status=data.get("thermal_alert_status", False),
            room_location=data.get("room_location", "Meeting Room A"),
        )
        db.session.add(row)
        db.session.commit()
        db.session.refresh(row)
        return row

    def find_all(self) -> list[SensorReading]:
        return SensorReading.query.order_by(SensorReading.created_at.desc()).all()

    def find_recent_temps(self, n: int = 5) -> list[float]:
        """Return the last *n* filtered temperatures (oldest first)."""
        rows = (
            SensorReading.query.order_by(SensorReading.created_at.desc()).limit(n).all()
        )
        return [r.filtered_temperature for r in reversed(rows)]

    def find_last_24h_no_motion(self) -> list[dict[str, Any]]:
        """Return readings from the last 24 h where motion_detected is False."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        rows = SensorReading.query.filter(
            SensorReading.created_at >= cutoff,
            SensorReading.motion_detected.is_(False),
        ).all()
        return [
            {"raw_temperature": r.raw_temperature, "motion_detected": r.motion_detected}
            for r in rows
        ]

    def find_recent_with_motion(self, minutes: int = 15) -> list[dict[str, Any]]:
        """Return the first and last motion readings in the time window.

        Thermal inertia only compares these two readings. Filter in PostgreSQL
        so each telemetry POST does not load the whole window into Python.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)
        query = SensorReading.query.with_entities(
            SensorReading.id,
            SensorReading.filtered_temperature,
            SensorReading.created_at,
        ).filter(
            SensorReading.created_at >= cutoff,
            SensorReading.motion_detected.is_(True),
        )

        first = query.order_by(
            SensorReading.created_at.asc(), SensorReading.id.asc()
        ).first()
        if first is None:
            return []

        last = query.order_by(
            SensorReading.created_at.desc(), SensorReading.id.desc()
        ).first()
        rows = [first] if first.id == last.id else [first, last]
        return [
            {
                "filtered_temperature": r.filtered_temperature,
                "motion_detected": True,
                "created_at": r.created_at,
            }
            for r in rows
        ]

    def find_paginated(
        self,
        limit: int = 50,
        offset: int = 0,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> tuple[list[SensorReading], int]:
        """Return paginated readings with optional date filters."""
        query = SensorReading.query

        if start_date:
            query = query.filter(SensorReading.created_at >= start_date)
        if end_date:
            query = query.filter(SensorReading.created_at <= end_date)

        total = query.count()
        rows = (
            query.order_by(SensorReading.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return rows, total
