"""
Database package exports.

Legacy scripts in this project import `Base`, `engine`, and `SessionLocal`
from `app.database`. Re-exporting them keeps those scripts working while the
application uses the more explicit `app.database.session` dependency module.
"""

from app.database.database import Base, SessionLocal, engine

