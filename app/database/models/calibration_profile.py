from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, JSON, SmallInteger, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.models.base import Base

if TYPE_CHECKING:
    from app.database.models.patient import Patient


class CalibrationProfile(Base):
    __tablename__ = "calibration_profile"
    __table_args__ = (
        UniqueConstraint("patient_id", "installation_id", "setup_key", name="uq_calibration_profile_lookup"),
        CheckConstraint("accuracy_score BETWEEN 55 AND 100", name="ck_calibration_profile_accuracy_score"),
        CheckConstraint("last_verification_score IS NULL OR last_verification_score BETWEEN 0 AND 100", name="ck_calibration_profile_verification_score"),
        CheckConstraint("payload_version > 0 AND score_version > 0", name="ck_calibration_profile_versions"),
        CheckConstraint("validation_rms >= 0 AND validation_p95 >= 0", name="ck_calibration_profile_validation_errors"),
    )

    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid4)
    patient_id: Mapped[UUID] = mapped_column(ForeignKey("patient.id", ondelete="CASCADE"), nullable=False)
    installation_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    setup_key: Mapped[str] = mapped_column(String(64), nullable=False)
    engine: Mapped[str] = mapped_column(String(30), nullable=False)
    engine_version: Mapped[str] = mapped_column(String(40), nullable=False)
    payload_version: Mapped[int] = mapped_column(nullable=False)
    score_version: Mapped[int] = mapped_column(nullable=False)
    accuracy_score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    validation_rms: Mapped[float] = mapped_column(nullable=False)
    validation_p95: Mapped[float] = mapped_column(nullable=False)
    training_data: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=False)
    setup_metadata: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=False)
    pose_reference: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_verification_score: Mapped[int | None] = mapped_column(SmallInteger)

    patient: Mapped[Patient] = relationship(back_populates="calibration_profiles")