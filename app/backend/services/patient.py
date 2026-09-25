"""Patient queries backed by PostgreSQL."""

from dataclasses import asdict, dataclass
from app.database.repositories import PatientRepository
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