from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.models.base import Base

if TYPE_CHECKING:
    from app.database.models.nurse import Nurse
    from app.database.models.notification import Notification
    from app.database.models.patient_link_code import PatientLinkCode
    from app.database.models.room import Room


class Patient(Base):
    __tablename__ = "patient"
    __table_args__ = (Index("ix_patient_nurse_id", "nurse_id"),)

    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid4)
    external_id: Mapped[str | None] = mapped_column(String(80), unique=True)
    nurse_id: Mapped[UUID | None] = mapped_column(ForeignKey("nurse.id", ondelete="RESTRICT"))
    room_id: Mapped[UUID | None] = mapped_column(ForeignKey("room.id", ondelete="SET NULL"))
    patient_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    details: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    nurse: Mapped[Nurse | None] = relationship(back_populates="patients")
    room: Mapped[Room | None] = relationship(back_populates="patients")
    link_codes: Mapped[list[PatientLinkCode]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    notifications: Mapped[list[Notification]] = relationship(back_populates="patient")
