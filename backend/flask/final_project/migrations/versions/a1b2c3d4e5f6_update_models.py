"""update models and create access_audits and room_configs

Revision ID: a1b2c3d4e5f6
Revises: f8a1b2c3d4e5
Create Date: 2026-06-11

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "f8a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Update sensor_readings table
    # Drop old columns: temperature, humidity
    op.drop_column("sensor_readings", "temperature")
    op.drop_column("sensor_readings", "humidity")

    # Add new columns matching the updated model
    op.add_column(
        "sensor_readings", sa.Column("raw_temperature", sa.Float(), nullable=False)
    )
    op.add_column(
        "sensor_readings", sa.Column("filtered_temperature", sa.Float(), nullable=False)
    )
    op.add_column(
        "sensor_readings", sa.Column("motion_detected", sa.Boolean(), nullable=False)
    )
    op.add_column(
        "sensor_readings",
        sa.Column(
            "thermal_alert_status",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "sensor_readings",
        sa.Column("room_location", sa.String(length=128), nullable=False),
    )

    # 2. Create access_audits table
    op.create_table(
        "access_audits",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("pin_entered", sa.String(length=4), nullable=False),
        sa.Column("is_success", sa.Boolean(), nullable=False),
        sa.Column("strategy_used", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # 3. Create room_configs table
    op.create_table(
        "room_configs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("room_name", sa.String(length=128), nullable=False),
        sa.Column("base_temp_limit", sa.Float(), nullable=False),
        sa.Column("inertia_time_minutes", sa.Integer(), nullable=False),
        sa.Column("target_temperature", sa.Float(), nullable=False),
        sa.Column("current_mode", sa.String(length=64), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("room_name"),
    )


def downgrade():
    # 3. Drop room_configs table
    op.drop_table("room_configs")

    # 2. Drop access_audits table
    op.drop_table("access_audits")

    # 1. Revert sensor_readings table
    op.drop_column("sensor_readings", "room_location")
    op.drop_column("sensor_readings", "thermal_alert_status")
    op.drop_column("sensor_readings", "motion_detected")
    op.drop_column("sensor_readings", "filtered_temperature")
    op.drop_column("sensor_readings", "raw_temperature")
    op.add_column("sensor_readings", sa.Column("humidity", sa.Float(), nullable=False))
    op.add_column(
        "sensor_readings", sa.Column("temperature", sa.Float(), nullable=False)
    )
