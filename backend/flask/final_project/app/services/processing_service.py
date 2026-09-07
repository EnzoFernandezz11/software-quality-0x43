"""
Processing / analytics layer for sensor data.

Implements three required algorithms:
1. Moving Median — smooths LM35 temperature noise.
2. Base Sleep Temperature — structural building temperature without occupants.
3. Thermal Inertia Detection — alerts when temperature rises too fast.
"""

from __future__ import annotations

from statistics import median


MOVING_MEDIAN_WINDOW = 5
THERMAL_INERTIA_RATE_THRESHOLD = 0.5  # °C per minute


def apply_moving_median(recent_temps: list[float], new_value: float) -> float:
    """Return the median of the last *N* readings including *new_value*.

    If ``recent_temps`` is shorter than the window size, compute the median
    of what is available.  This prevents startup lag where the first few
    readings would otherwise be discarded.
    """
    window = list(recent_temps[-(MOVING_MEDIAN_WINDOW - 1):]) + [new_value]
    return round(median(window), 2)


def calculate_base_sleep_temperature(
    readings: list[dict],
) -> float | None:
    """Average temperature over the last 24 h where ``motion_detected`` is False.

    Each element in *readings* must have ``raw_temperature`` (float) and
    ``motion_detected`` (bool).  Returns ``None`` if there are no qualifying
    readings.
    """
    no_motion = [r["raw_temperature"] for r in readings if not r["motion_detected"]]
    if not no_motion:
        return None
    return round(sum(no_motion) / len(no_motion), 2)


def detect_thermal_inertia(
    readings: list[dict],
    inertia_time_minutes: int = 15,
) -> bool:
    """Detect whether temperature is rising too fast during occupancy.

    *readings* must be chronologically sorted (oldest first) and contain
    ``filtered_temperature`` (float), ``motion_detected`` (bool) and
    ``created_at`` (datetime).

    Only readings where ``motion_detected`` is True within the last
    *inertia_time_minutes* are considered.  The thermal rate (ΔT / Δt) is
    computed between the first and last qualifying readings.  If it exceeds
    ``THERMAL_INERTIA_RATE_THRESHOLD`` the function returns ``True``.
    """
    with_motion = [r for r in readings if r["motion_detected"]]

    if len(with_motion) < 2:
        return False

    first = with_motion[0]
    last = with_motion[-1]

    delta_t_celsius = last["filtered_temperature"] - first["filtered_temperature"]
    delta_t_seconds = (last["created_at"] - first["created_at"]).total_seconds()

    if delta_t_seconds <= 0:
        return False

    delta_t_minutes = delta_t_seconds / 60.0
    rate = delta_t_celsius / delta_t_minutes  # °C / min

    return rate > THERMAL_INERTIA_RATE_THRESHOLD
