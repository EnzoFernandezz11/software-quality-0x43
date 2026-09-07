"""
Marshmallow schema for the authentication endpoint (POST /api/auth/validate).

Validates that the PIN is a 4-digit numeric string.
"""

from marshmallow import Schema, fields, validate


class AuthInputSchema(Schema):
    pin = fields.String(
        required=True,
        validate=[
            validate.Length(equal=4),
            validate.Regexp(r"^\d{4}$", error="PIN must be a 4-digit numeric string."),
        ],
    )
    strategy = fields.String(
        required=False,
        validate=validate.OneOf(["LocalMemoryAuthStrategy", "ExternalApiAuthStrategy"]),
    )
