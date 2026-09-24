from __future__ import annotations

from datetime import datetime
from typing import Any, TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.models.base import Base

if TYPE_CHECKING:
    from app.database.models.patient import Patient


class Notification(Base):
    __tablename__ = "notification"
    __table_args__ = (
        Index("ix_notification_recipient_created_at", "recipient", "created_at"),
        Index("ix_notification_patient_id", "patient_id"),
    )

    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid4)
    source: Mapped[str] = mapped_column(String(30), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    patient_id: Mapped[UUID | None] = mapped_column(ForeignKey("patient.id", ondelete="SET NULL"))
    patient_metadata: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    sender_metadata: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    recipient: Mapped[str] = mapped_column(String(30), nullable=False, default="nurse")
    read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    patient: Mapped[Patient | None] = relationship(back_populates="notifications")
