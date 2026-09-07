"""
Observer pattern 1 — Live Metrics Subject.

``LiveMetricsSubject`` maintains a list of ``MetricsObserver`` subscribers
and notifies them every time a new ``SensorReading`` is persisted.

Concrete observers:
- ``CacheMetricsUpdater`` — stores the latest reading in a fast in-memory
  dict so the ``/api/dashboard/live`` endpoint responds instantly.
- ``LiveConsoleLogger`` — prints thermal alerts to stdout for debugging.
"""

from __future__ import annotations

from typing import Any


class MetricsObserver:
    """Interface for observers that react to new sensor readings."""

    def update(self, reading_data: dict[str, Any]) -> None:
        """Called by the subject with the serialized reading dict."""


class CacheMetricsUpdater(MetricsObserver):
    """Stores the latest reading in an in-memory dictionary (fast cache)."""

    def __init__(self) -> None:
        self._cache: dict[str, Any] = {}

    def update(self, reading_data: dict[str, Any]) -> None:
        self._cache = reading_data

    @property
    def last_reading(self) -> dict[str, Any]:
        return self._cache


class LiveConsoleLogger(MetricsObserver):
    """Logs thermal alerts to console for live monitoring."""

    def update(self, reading_data: dict[str, Any]) -> None:
        if reading_data.get("thermal_alert_status"):
            print(
                f"[THERMAL ALERT] Sensor {reading_data.get('sensor_id')} "
                f"at {reading_data.get('room_location')}: "
                f"temperature={reading_data.get('filtered_temperature')}°C"
            )


class LiveMetricsSubject:
    """Subject that notifies subscribers when new telemetry arrives."""

    def __init__(self) -> None:
        self._observers: list[MetricsObserver] = []

    def subscribe(self, observer: MetricsObserver) -> None:
        self._observers.append(observer)

    def unsubscribe(self, observer: MetricsObserver) -> None:
        self._observers.remove(observer)

    def notify(self, reading_data: dict[str, Any]) -> None:
        for observer in self._observers:
            observer.update(reading_data)
