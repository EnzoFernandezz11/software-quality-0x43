"""Index sensor reading timestamps for recent telemetry queries.

Revision ID: b7c9e2f4a601
Revises: a1b2c3d4e5f6
"""

from alembic import op


revision = "b7c9e2f4a601"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        "ix_sensor_readings_created_at", "sensor_readings", ["created_at"]
    )


def downgrade():
    op.drop_index("ix_sensor_readings_created_at", table_name="sensor_readings")
