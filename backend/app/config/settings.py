"""
Application configuration for the Digital PSSR Portal.

The settings object is intentionally centralized because refinery workflow
software usually runs in several controlled environments: local engineering,
test, staging, disaster-recovery, and production. Keeping operational knobs in
one module makes deployments predictable and keeps secrets out of route code.
"""

from functools import lru_cache
import os
from typing import List

from dotenv import load_dotenv

load_dotenv()

"""
Application configuration for the Digital PSSR Portal.
"""

from functools import lru_cache
import os
from typing import List

from dotenv import load_dotenv

load_dotenv()


class Settings:
    """
    Centralized application settings.
    """

    APP_NAME: str = os.getenv("APP_NAME", "Digital PSSR Portal")

    APP_VERSION: str = os.getenv("APP_VERSION", "1.0.0")

    APP_ENV: str = os.getenv("APP_ENV", "development")

    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"

    API_PREFIX: str = os.getenv("API_PREFIX", "/api/v1")

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./digital_pssr_dev.db",
    )

    JWT_SECRET_KEY: str = os.getenv(
        "JWT_SECRET_KEY",
        os.getenv("JWT_SECRET", "change-this-development-secret-before-production"),
    )

    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")

    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480")
    )

    CORS_ORIGINS: List[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            (
                "http://localhost:3000,"
                "http://127.0.0.1:3000,"
                "http://10.251.175.178:3000"
            ),
        ).split(",")
        if origin.strip()
    ]

    CORS_ALLOW_CREDENTIALS: bool = (
        os.getenv("CORS_ALLOW_CREDENTIALS", "true").lower() == "true"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
