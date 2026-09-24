from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.models import Notification, Patient


class NotificationRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create(
        self,
        *,
        source: str,
        type: str,
        severity: str,
        message: str,
        patient_metadata: dict[str, Any],
        recipient: str,
        sender_metadata: dict[str, Any],
    ) -> Notification:
        now = datetime.now(timezone.utc)
        second_start = now.replace(microsecond=0)
        second_end = second_start.replace(microsecond=0) + timedelta(seconds=1)
        patient_external_id = patient_metadata.get("patient_id")
        patient = None
        if isinstance(patient_external_id, str):
            patient = self.session.scalar(
                select(Patient).where(Patient.external_id == patient_external_id)
            )
        duplicate = self.session.scalar(
            select(Notification)
            .where(
                Notification.source == source,
                Notification.type == type,
                Notification.message == message,
                Notification.recipient == recipient,
                Notification.patient_metadata["patient_id"].as_string() == patient_metadata.get("patient_id"),
                Notification.created_at >= second_start,
                Notification.created_at < second_end,
            )
            .order_by(Notification.created_at.desc())
        )
        if duplicate is not None:
            return duplicate

        notification = Notification(
            id=uuid4(),
            source=source,
            type=type,
            severity=severity,
            message=message,
            patient_metadata=patient_metadata,
            recipient=recipient,
            sender_metadata=sender_metadata,
            patient_id=patient.id if patient is not None else None,
            created_at=now,
        )
        self.session.add(notification)
        self.session.flush()
        return notification

    def list(self, *, include_read: bool = True, recipient: str | None = None) -> list[Notification]:
        query = select(Notification).order_by(Notification.created_at.desc())
        if not include_read:
            query = query.where(Notification.read.is_(False))
        if recipient is not None:
            query = query.where(Notification.recipient == recipient)
        return list(self.session.scalars(query))

    def mark_read(self, notification_id: UUID) -> Notification | None:
        notification = self.session.get(Notification, notification_id)
        if notification is None:
            return None
        notification.read = True
        self.session.flush()
        return notification

    def delete(self, notification_id: UUID) -> Notification | None:
        notification = self.session.get(Notification, notification_id)
        if notification is None:
            return None
        self.session.delete(notification)
        self.session.flush()
        return notification
