"""Checklist sections within an annexure."""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class AnnexureSection(Base):
    """Document, field, or custom checkpoint grouping."""

    __tablename__ = "annexure_sections"

    id = Column(Integer, primary_key=True, index=True)
    annexure_id = Column(Integer, ForeignKey("annexures.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    section_type = Column(String(40), nullable=False, default="CUSTOM", index=True)
    description = Column(Text, nullable=True)
    responsible_department = Column(String(120), nullable=True, index=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    annexure = relationship("Annexure", back_populates="sections")
    questions = relationship(
        "AnnexureQuestion",
        back_populates="section",
        cascade="all, delete-orphan",
        order_by="AnnexureQuestion.sort_order",
    )

    __table_args__ = (
        UniqueConstraint("annexure_id", "title", name="uq_annexure_section_title"),
        Index("ix_annexure_sections_annexure_sort", "annexure_id", "sort_order"),
        Index("ix_annexure_sections_type", "section_type"),
    )
