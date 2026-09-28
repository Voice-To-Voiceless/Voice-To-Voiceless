"""Patient queries backed by PostgreSQL."""

from dataclasses import asdict, dataclass
from sqlalchemy import or_, select
from app.database.repositories import PatientRepository
from app.database.models import Patient
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
            query = select(Patient).where(
                or_(
                    Patient.patient_code == normalized_code,
                    Patient.external_id == normalized_code,
                    (normalized_code == "VT-2026-001") & (Patient.external_id == "patient-001"),
                )
            )
            record = session.scalar(query)
            if record is None:
                return None

            return PatientSummary(
                id=record.external_id or str(record.id),
                name=record.full_name,
                room=record.room.name if record.room is not None else "",
                details=record.details or "",
            )
