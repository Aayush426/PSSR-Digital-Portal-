"""
Password hashing utilities.

All password verification is isolated here so future enterprise requirements,
such as password rotation policy or migration to an identity provider, do not
leak into route handlers.
"""

import bcrypt


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Validate a plaintext password against the stored bcrypt hash."""

    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        password_hash.encode("utf-8"),
    )


def hash_password(plain_password: str) -> str:
    """Hash a password for seed scripts and controlled administrative tooling."""

    return bcrypt.hashpw(
        plain_password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")
