"""Shared notification model and in-memory notification service."""

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Any
from uuid import uuid4


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


class NotificationService:
    """Store and coordinate notifications from all detection services."""

    def __init__(self) -> None:
        self._notifications: list[Notification] = []
        self._lock = Lock()

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
        notification = Notification(
            id=str(uuid4()),
            source=source,
            type=type,
            severity=severity,
            message=message,
            patient_metadata=patient_metadata,
            created_at=datetime.now(timezone.utc).isoformat(),
            recipient=recipient,
            sender_metadata=sender_metadata or {},
        )
        with self._lock:
            self._notifications.insert(0, notification)
        return notification

    def list(self, *, include_read: bool = True) -> list[Notification]:
        with self._lock:
            notifications = list(self._notifications)
        if include_read:
            return notifications
        return [notification for notification in notifications if not notification.read]

    def mark_read(self, notification_id: str) -> Notification | None:
        with self._lock:
            for notification in self._notifications:
                if notification.id == notification_id:
                    notification.read = True
                    return notification
        return None