"""
Marshmallow schemas for the telemetry endpoint (POST /api/telemetry).

- ``TelemetryInputSchema`` — validates the ESP32 payload.
- ``TelemetryResponseSchema`` — serializes a ``SensorReading`` for the API response.
"""

from marshmallow import Schema, fields


class TelemetryInputSchema(Schema):
    sensor_id = fields.String(required=True)
    raw_temperature = fields.Float(required=True)
    motion_detected = fields.Boolean(required=True)


class TelemetryResponseSchema(Schema):
    id = fields.Integer()
    sensor_id = fields.String()
    raw_temperature = fields.Float()
    filtered_temperature = fields.Float()
    motion_detected = fields.Boolean()
    thermal_alert_status = fields.Boolean()
    room_location = fields.String()
    created_at = fields.DateTime()
