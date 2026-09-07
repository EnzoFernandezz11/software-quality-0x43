"""
Authentication service (Context) + Observer pattern 2 (Security Auditor).

``AuthenticationService`` acts as the Strategy *context*: it delegates PIN
validation to the active ``AuthenticationStrategy`` and then notifies all
registered ``AuthObserver`` instances of the outcome.

Concrete observers:
- ``SecurityAuditor`` — persists each attempt in the ``access_audits`` table.
- ``SystemAlerter`` — logs failed attempts to stdout for monitoring.
"""

from __future__ import annotations

from app.extensions import db
from app.models.entities.access_audit import AccessAudit
from app.services.auth_strategies import (
    AuthenticationStrategy,
    LocalMemoryAuthStrategy,
)


# ---------------------------------------------------------------------------
# Observer interface + concrete observers
# ---------------------------------------------------------------------------


class AuthObserver:
    """Interface for observers that react to authentication events."""

    def update_auth(self, pin: str, success: bool, strategy: str) -> None:
        """Called after every PIN validation attempt."""


class SecurityAuditor(AuthObserver):
    """Persists every PIN attempt in the ``access_audits`` table."""

    def update_auth(self, pin: str, success: bool, strategy: str) -> None:
        audit = AccessAudit(
            pin_entered=pin,
            is_success=success,
            strategy_used=strategy,
        )
        db.session.add(audit)
        db.session.commit()


class SystemAlerter(AuthObserver):
    """Logs failed access attempts to stdout for real-time monitoring."""

    def update_auth(self, pin: str, success: bool, strategy: str) -> None:
        if not success:
            print(
                f"[SECURITY] Failed access attempt — " f"PIN=****, strategy={strategy}"
            )


# ---------------------------------------------------------------------------
# Authentication Service (Strategy Context + Observer Subject)
# ---------------------------------------------------------------------------


class AuthenticationService:
    """Validates PINs via the active strategy and notifies observers."""

    def __init__(
        self,
        strategy: AuthenticationStrategy | None = None,
    ) -> None:
        self._strategy = strategy or LocalMemoryAuthStrategy()
        self._observers: list[AuthObserver] = []

    # -- Strategy management -------------------------------------------------

    def set_strategy(self, strategy: AuthenticationStrategy) -> None:
        self._strategy = strategy

    @property
    def strategy_name(self) -> str:
        return self._strategy.name

    # -- Observer management -------------------------------------------------

    def subscribe(self, observer: AuthObserver) -> None:
        self._observers.append(observer)

    def _notify_observers(self, pin: str, success: bool) -> None:
        for observer in self._observers:
            observer.update_auth(pin, success, self.strategy_name)

    # -- Core authentication -------------------------------------------------

    def authenticate(self, pin: str) -> bool:
        success = self._strategy.validate_pin(pin)
        self._notify_observers(pin, success)
        return success
