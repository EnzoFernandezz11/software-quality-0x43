"""
SQLAlchemy model for access audit records.

Mapped to the ``access_audits`` table. Each row represents a keypad PIN
validation attempt logged by the SecurityAuditor observer.
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db


class AccessAudit(db.Model):
    __tablename__ = "access_audits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pin_entered: Mapped[str] = mapped_column(String(4), nullable=False)
    is_success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    strategy_used: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
