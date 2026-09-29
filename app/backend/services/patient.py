"""Patient queries backed by PostgreSQL."""

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import hashlib
from sqlalchemy import or_, select
from sqlalchemy.orm import joinedload
from app.database.repositories import PatientRepository
from app.database.models import Nurse, Patient, PatientLinkCode
from app.database.session import session_scope


@dataclass
class PatientSummary:
    id: str
    name: str
    room: str
    details: str

    def to_dict(self) -> dict[str, str]:
        return asdict(self)


class PatientService:
    def list(self) -> list[PatientSummary]:
        with session_scope() as session:
            records = PatientRepository(session).list()
            return [
                PatientSummary(
                    id=record.external_id or str(record.id),
                    name=record.full_name,
                    room=record.room.name if record.room is not None else "",
                    details=record.details or "",
                )
                for record in records
            ]

    def link_by_code(self, code: str) -> PatientSummary | None:
        normalized_code = code.strip().upper()
        if not normalized_code:
            return None

        with session_scope() as session:
            # The tablet currently displays VT-2026-001 as the demo code. Keep
            # that code compatible with the first seeded development patient.
            query = select(Patient).options(joinedload(Patient.room)).where(
                or_(Patient.patient_code == normalized_code, Patient.external_id == normalized_code)
            )
            record = session.scalar(query)
            if record is None and normalized_code == "VT-2026-001":
                record = session.scalar(
                    select(Patient).options(joinedload(Patient.room)).where(Patient.external_id == "patient-001")
                )
            if record is None:
                code_hash = hashlib.sha256(normalized_code.encode("utf-8")).hexdigest()
                link_code = session.scalar(
                    select(PatientLinkCode)
                    .options(joinedload(PatientLinkCode.patient).joinedload(Patient.room))
                    .where(
                        PatientLinkCode.code_hash == code_hash,
                        or_(
                            PatientLinkCode.used_at.is_not(None),
                            PatientLinkCode.expires_at > datetime.now(timezone.utc),
                        ),
                    )
                    .with_for_update()
                )
                if link_code is not None:
                    record = link_code.patient
                    nurse = session.scalar(select(Nurse).where(Nurse.full_name == "Asistenta de serviciu"))
                    if nurse is not None:
                        if record.nurse_id is not None and record.nurse_id != nurse.id:
                            raise ValueError("Patient is already assigned to another nurse")
                        if record.nurse_id is None:
                            record.nurse_id = nurse.id
                    if link_code.used_at is None:
                        link_code.used_at = datetime.now(timezone.utc)
            if record is None:
                return None

            return PatientSummary(
                id=record.external_id or str(record.id),
                name=record.full_name,
                room=record.room.name if record.room is not None else "",
                details=record.details or "",
            )
