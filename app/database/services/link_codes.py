from __future__ import annotations

from datetime import datetime, timezone
import hashlib
from uuid import UUID

from sqlalchemy import select

from app.database.factories import make_link_code
from app.database.models import Patient, PatientLinkCode
from app.database.session import session_scope


class LinkCodeService:
    """Issue and redeem one-time patient pairing codes."""

    def issue(self, patient_id: UUID, *, lifetime_minutes: int = 15) -> str:
        with session_scope() as session:
            patient = session.get(Patient, patient_id)
            if patient is None:
                raise ValueError("Patient not found")

            record, plain_code = make_link_code(patient_id, lifetime_minutes=lifetime_minutes)
            session.add(PatientLinkCode(**record))
            return plain_code

    def redeem(self, nurse_id: UUID, plain_code: str) -> Patient:
        code_hash = hashlib.sha256(plain_code.encode("utf-8")).hexdigest()
        now = datetime.now(timezone.utc)

        with session_scope() as session:
            link_code = session.scalar(
                select(PatientLinkCode)
                .where(
                    PatientLinkCode.code_hash == code_hash,
                    PatientLinkCode.used_at.is_(None),
                    PatientLinkCode.expires_at > now,
                )
                .with_for_update()
            )
            if link_code is None:
                raise ValueError("Invalid, expired, or already used link code")

            patient = session.get(Patient, link_code.patient_id)
            if patient is None:
                raise ValueError("Linked patient not found")
            if patient.nurse_id is not None and patient.nurse_id != nurse_id:
                raise ValueError("Patient is already assigned to another nurse")

            patient.nurse_id = nurse_id
            link_code.used_at = now
            session.flush()
            return patient
