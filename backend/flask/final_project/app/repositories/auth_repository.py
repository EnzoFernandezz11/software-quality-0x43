"""
PostgreSQL access for access audit records (Flask-SQLAlchemy).

Used by the ``SecurityAuditor`` observer and the dashboard security-logs
endpoint.
"""

from __future__ import annotations

from app.extensions import db
from app.models.entities.access_audit import AccessAudit


class AuthRepository:
    def save(self, data: dict) -> AccessAudit:
        row = AccessAudit(
            pin_entered=data["pin_entered"],
            is_success=data["is_success"],
            strategy_used=data["strategy_used"],
        )
        db.session.add(row)
        db.session.commit()
        db.session.refresh(row)
        return row

    def find_all(self) -> list[AccessAudit]:
        return AccessAudit.query.order_by(AccessAudit.created_at.desc()).all()
