"""
SQLAlchemy model for persisted sensor measurements.

Mapped to the ``sensor_readings`` table with columns aligned to the
Smart Office telemetry contract (LM35 temperature + PIR motion).
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db


class SensorReading(db.Model):
    __tablename__ = "sensor_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sensor_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    raw_temperature: Mapped[float] = mapped_column(Float, nullable=False)
    filtered_temperature: Mapped[float] = mapped_column(Float, nullable=False)
    motion_detected: Mapped[bool] = mapped_column(Boolean, nullable=False)
    thermal_alert_status: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    room_location: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
