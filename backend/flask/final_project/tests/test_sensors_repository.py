"""Behavior of the bounded query used for thermal inertia detection."""

from datetime import datetime, timedelta, timezone

from app.extensions import db
from app.models.entities.sensor_reading import SensorReading
from app.repositories.sensors_repository import SensorsRepository
from app.services.processing_service import detect_thermal_inertia


def _reading(now: datetime, minutes_ago: int, temp: float, motion: bool):
    return SensorReading(
        sensor_id="esp32-test",
        raw_temperature=temp,
        filtered_temperature=temp,
        motion_detected=motion,
        thermal_alert_status=False,
        room_location="Test",
        created_at=now - timedelta(minutes=minutes_ago),
    )


def test_recent_motion_query_keeps_thermal_inertia_result(app):
    # The session fixture rolls back this deletion and the test rows afterward.
    SensorReading.query.delete()
    db.session.flush()
    repo = SensorsRepository()
    now = datetime.now(timezone.utc)

    assert repo.find_recent_with_motion(minutes=15) == []

    db.session.add_all(
        [
            _reading(now, 20, 10.0, True),  # outside the window
            _reading(now, 10, 50.0, False),  # inside, without motion
        ]
    )
    db.session.flush()
    assert repo.find_recent_with_motion(minutes=15) == []

    db.session.add(_reading(now, 8, 22.0, True))
    db.session.flush()
    one = repo.find_recent_with_motion(minutes=15)
    assert [row["filtered_temperature"] for row in one] == [22.0]
    assert detect_thermal_inertia(one) is False

    db.session.add_all(
        [
            _reading(now, 5, 23.0, True),
            _reading(now, 3, 70.0, False),
            _reading(now, 1, 27.0, True),
        ]
    )
    db.session.flush()
    recent = repo.find_recent_with_motion(minutes=15)
    assert [row["filtered_temperature"] for row in recent] == [22.0, 27.0]
    assert all(row["motion_detected"] for row in recent)
    assert detect_thermal_inertia(recent) is True
