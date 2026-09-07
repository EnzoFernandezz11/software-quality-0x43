"""
SQLAlchemy model for room configuration.

Mapped to the ``room_configs`` table. Stores dynamic thresholds and the
current operating mode used by the processing algorithms and the frontend
configuration panel.
"""

from sqlalchemy import Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db


class RoomConfig(db.Model):
    __tablename__ = "room_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    room_name: Mapped[str] = mapped_column(
        String(128), nullable=False, unique=True, default="Meeting Room A"
    )
    base_temp_limit: Mapped[float] = mapped_column(Float, nullable=False, default=21.0)
    inertia_time_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, default=15
    )
    target_temperature: Mapped[float] = mapped_column(
        Float, nullable=False, default=24.0
    )
    current_mode: Mapped[str] = mapped_column(
        String(64), nullable=False, default="Normal"
    )
