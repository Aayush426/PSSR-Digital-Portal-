"""
Password hashing utilities.

All password verification is isolated here so future enterprise requirements,
such as password rotation policy or migration to an identity provider, do not
leak into route handlers or seed scripts.
"""

import bcrypt
from passlib.context import CryptContext


password_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Validate a plaintext password against the stored passlib hash."""

    if password_hash.startswith("$2"):
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            password_hash.encode("utf-8"),
        )

    return password_context.verify(plain_password, password_hash)


def hash_password(plain_password: str) -> str:
    """Hash a password for seed scripts and controlled administrative tooling."""

    return password_context.hash(plain_password)
