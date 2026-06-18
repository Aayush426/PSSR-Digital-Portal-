"""Version-controlled annexure templates and uploaded source documents."""

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class AnnexureTemplate(Base):
    """Template metadata for downloadable/uploaded annexure files."""

    __tablename__ = "annexure_templates"

    id = Column(Integer, primary_key=True, index=True)
    annexure_id = Column(Integer, ForeignKey("annexures.id", ondelete="CASCADE"), nullable=False, index=True)
    version = Column(String(40), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False, default=0)
    mime_type = Column(String(120), nullable=False)
    file_type = Column(String(80), nullable=False)
    storage_path = Column(String(500), nullable=False)
    checksum = Column(String(128), nullable=True)
    uploaded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    active = Column(Boolean, nullable=False, default=True, index=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    notes = Column(Text, nullable=True)

    annexure = relationship("Annexure", back_populates="templates")

    __table_args__ = (
        UniqueConstraint("annexure_id", "version", name="uq_annexure_template_version"),
        Index("ix_annexure_templates_annexure_active", "annexure_id", "is_active"),
    )
