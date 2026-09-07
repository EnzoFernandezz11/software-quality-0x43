"""Tests for the three backend algorithms in processing_service."""

from datetime import datetime, timedelta, timezone

from app.services.processing_service import (
    apply_moving_median,
    calculate_base_sleep_temperature,
    detect_thermal_inertia,
)


# ---------------------------------------------------------------------------
# Moving Median
# ---------------------------------------------------------------------------


class TestApplyMovingMedian:
    def test_single_value(self):
        result = apply_moving_median([], 25.0)
        assert result == 25.0

    def test_odd_window(self):
        recent = [22.0, 24.0, 24.0, 26.0]
        result = apply_moving_median(recent, 23.0)
        # window = [22.0, 24.0, 24.0, 26.0] (last 4) + new = 5 values
        # sorted: [22.0, 23.0, 24.0, 24.0, 26.0] → median = 24.0
        assert result == 24.0

    def test_filters_noise_spike(self):
        recent = [23.0, 23.5, 23.2, 23.1]
        result = apply_moving_median(recent, 99.0)  # noise spike
        # window = [23.5, 23.2, 23.1, 99.0] (last 4) + new already included
        # Actually: recent[-(5-1):] = [23.0, 23.5, 23.2, 23.1], + 99.0
        # sorted: [23.0, 23.1, 23.2, 23.5, 99.0] → median = 23.2
        assert result == 23.2


# ---------------------------------------------------------------------------
# Base Sleep Temperature
# ---------------------------------------------------------------------------


class TestCalculateBaseSleepTemperature:
    def test_returns_none_when_no_readings(self):
        assert calculate_base_sleep_temperature([]) is None

    def test_filters_motion_readings(self):
        readings = [
            {"raw_temperature": 20.0, "motion_detected": False},
            {"raw_temperature": 30.0, "motion_detected": True},
            {"raw_temperature": 22.0, "motion_detected": False},
        ]
        result = calculate_base_sleep_temperature(readings)
        assert result == 21.0  # (20 + 22) / 2

    def test_all_motion_returns_none(self):
        readings = [
            {"raw_temperature": 25.0, "motion_detected": True},
        ]
        assert calculate_base_sleep_temperature(readings) is None


# ---------------------------------------------------------------------------
# Thermal Inertia
# ---------------------------------------------------------------------------


class TestDetectThermalInertia:
    def test_returns_false_with_insufficient_data(self):
        assert detect_thermal_inertia([]) is False
        assert (
            detect_thermal_inertia(
                [
                    {
                        "filtered_temperature": 20,
                        "motion_detected": True,
                        "created_at": datetime.now(timezone.utc),
                    },
                ]
            )
            is False
        )

    def test_detects_fast_rise(self):
        now = datetime.now(timezone.utc)
        readings = [
            {
                "filtered_temperature": 20.0,
                "motion_detected": True,
                "created_at": now - timedelta(minutes=10),
            },
            {"filtered_temperature": 28.0, "motion_detected": True, "created_at": now},
        ]
        # Rate = 8°C / 10 min = 0.8 °C/min > 0.5 threshold
        assert detect_thermal_inertia(readings) is True

    def test_no_alert_on_slow_rise(self):
        now = datetime.now(timezone.utc)
        readings = [
            {
                "filtered_temperature": 20.0,
                "motion_detected": True,
                "created_at": now - timedelta(minutes=10),
            },
            {"filtered_temperature": 21.0, "motion_detected": True, "created_at": now},
        ]
        # Rate = 1°C / 10 min = 0.1 °C/min < 0.5 threshold
        assert detect_thermal_inertia(readings) is False

    def test_ignores_no_motion_readings(self):
        now = datetime.now(timezone.utc)
        readings = [
            {
                "filtered_temperature": 20.0,
                "motion_detected": False,
                "created_at": now - timedelta(minutes=5),
            },
            {"filtered_temperature": 28.0, "motion_detected": False, "created_at": now},
        ]
        assert detect_thermal_inertia(readings) is False
