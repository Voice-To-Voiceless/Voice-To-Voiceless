"""Notification DTO and PostgreSQL-backed notification service."""

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from app.database.repositories import NotificationRepository
from app.database.session import session_scope


@dataclass
class Notification:
    """A patient-related event that can be displayed to a nurse."""

    id: str
    source: str
    type: str
    severity: str
    message: str
    patient_metadata: dict[str, Any]
    created_at: str
    read: bool = False
    recipient: str = "nurse"
    sender_metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _to_dto(record: Any) -> Notification:
    created_at = record.created_at
    if isinstance(created_at, datetime):
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        created_at_value = created_at.isoformat()
    else:
        created_at_value = str(created_at)

    return Notification(
        id=str(record.id),
        source=record.source,
        type=record.type,
        severity=record.severity,
        message=record.message,
        patient_metadata=dict(record.patient_metadata or {}),
        created_at=created_at_value,
        read=record.read,
        recipient=record.recipient,
        sender_metadata=dict(record.sender_metadata or {}),
    )


class NotificationService:
    """Store and coordinate notifications in PostgreSQL."""

    def create(
        self,
        *,
        source: str,
        type: str,
        severity: str,
        message: str,
        patient_metadata: dict[str, Any],
        recipient: str = "nurse",
        sender_metadata: dict[str, Any] | None = None,
    ) -> Notification:
        with session_scope() as session:
            record = NotificationRepository(session).create(
                source=source,
                type=type,
                severity=severity,
                message=message,
                patient_metadata=patient_metadata,
                recipient=recipient,
                sender_metadata=sender_metadata or {},
            )
            return _to_dto(record)

    def list(self, *, include_read: bool = True, recipient: str | None = None) -> list[Notification]:
        with session_scope() as session:
            records = NotificationRepository(session).list(
                include_read=include_read,
                recipient=recipient,
            )
            return [_to_dto(record) for record in records]

    def mark_read(self, notification_id: str) -> Notification | None:
        try:
            parsed_id = UUID(notification_id)
        except ValueError:
            return None

        with session_scope() as session:
            record = NotificationRepository(session).mark_read(parsed_id)
            return _to_dto(record) if record is not None else None

    def delete(self, notification_id: str) -> Notification | None:
        try:
            parsed_id = UUID(notification_id)
        except ValueError:
            return None

        with session_scope() as session:
            record = NotificationRepository(session).delete(parsed_id)
            return _to_dto(record) if record is not None else None
