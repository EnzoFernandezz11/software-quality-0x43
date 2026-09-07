"""Tests for the Strategy pattern (authentication strategies)."""

from app.services.auth_strategies import (
    ExternalApiAuthStrategy,
    LocalMemoryAuthStrategy,
)


class TestLocalMemoryAuthStrategy:
    def test_valid_pin(self):
        strategy = LocalMemoryAuthStrategy()
        assert strategy.validate_pin("1234") is True

    def test_invalid_pin(self):
        strategy = LocalMemoryAuthStrategy()
        assert strategy.validate_pin("0000") is False

    def test_strategy_name(self):
        strategy = LocalMemoryAuthStrategy()
        assert strategy.name == "LocalMemoryAuthStrategy"


class TestExternalApiAuthStrategy:
    def test_valid_pin(self):
        strategy = ExternalApiAuthStrategy()
        assert strategy.validate_pin("9999") is True

    def test_invalid_pin(self):
        strategy = ExternalApiAuthStrategy()
        assert strategy.validate_pin("1234") is False

    def test_strategy_name(self):
        strategy = ExternalApiAuthStrategy()
        assert strategy.name == "ExternalApiAuthStrategy"
