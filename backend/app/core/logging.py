"""
Structured logging helpers.

Enterprise refinery systems need log lines that operations, cyber security, and
audit teams can correlate. This module keeps logger construction consistent and
lets middleware attach request IDs without each route inventing its own format.
"""

import logging
import sys


def get_logger(name: str) -> logging.Logger:
    """
    Return a configured application logger.

    The handler is installed once per logger to avoid duplicate lines during
    reloads. A future SIEM integration can replace this formatter with JSON
    output without touching business services.
    """

    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(RequestIdFilter())
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s %(levelname)s %(name)s request_id=%(request_id)s %(message)s"
        )
    )
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False
    return logger


class RequestIdFilter(logging.Filter):
    """Ensure log records always contain a request_id field."""

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = "-"
        return True
