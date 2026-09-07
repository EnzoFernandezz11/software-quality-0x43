"""
Strategy pattern for PIN authentication.

Defines the ``AuthenticationStrategy`` interface and two concrete
implementations:
- ``LocalMemoryAuthStrategy`` — validates against a hardcoded PIN.
- ``ExternalApiAuthStrategy`` — simulates validation via an external API.
"""

from __future__ import annotations

from abc import ABC, abstractmethod


class AuthenticationStrategy(ABC):
    """Interface for PIN validation strategies."""

    @abstractmethod
    def validate_pin(self, pin: str) -> bool:
        """Return True if *pin* is valid according to this strategy."""

    @property
    def name(self) -> str:
        return type(self).__name__


class LocalMemoryAuthStrategy(AuthenticationStrategy):
    """Validates PIN against a pre-seeded constant (in-memory)."""

    _VALID_PIN = "1234"

    def validate_pin(self, pin: str) -> bool:
        return pin == self._VALID_PIN


class ExternalApiAuthStrategy(AuthenticationStrategy):
    """Simulates validation via an external HTTP service."""

    _SIMULATED_VALID_PIN = "9999"

    def validate_pin(self, pin: str) -> bool:
        # In production this would be:
        # return requests.post(url, json={"pin": pin}).status_code == 200
        return pin == self._SIMULATED_VALID_PIN


class AuthStrategyFactory:
    """Factory that resolves and instantiates authentication strategies."""

    _strategies: dict[str, type[AuthenticationStrategy]] = {
        "LocalMemoryAuthStrategy": LocalMemoryAuthStrategy,
        "ExternalApiAuthStrategy": ExternalApiAuthStrategy,
    }

    @classmethod
    def get_strategy(cls, name: str | None = None) -> AuthenticationStrategy:
        """Return the matching strategy instance, defaults to LocalMemory."""
        strategy_class = cls._strategies.get(name, LocalMemoryAuthStrategy)
        return strategy_class()
