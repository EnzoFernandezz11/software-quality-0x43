"""
Marshmallow schema for room configuration (GET/PUT /api/config).

Validates thresholds and mode values for the room configuration panel.
"""

from marshmallow import Schema, fields, validate


class ConfigSchema(Schema):
    room_name = fields.String(required=True)
    base_temp_limit = fields.Float(
        required=True,
        validate=validate.Range(min=15, max=30),
    )
    inertia_time_minutes = fields.Integer(
        required=True,
        validate=validate.Range(min=1, max=120),
    )
    target_temperature = fields.Float(
        required=True,
        validate=validate.Range(min=15, max=35),
    )
    current_mode = fields.String(
        required=True,
        validate=validate.OneOf(["Normal", "Meeting", "Energy Saving"]),
    )
