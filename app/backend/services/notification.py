"""Shared notification model and in-memory notification service."""

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
import json
from pathlib import Path
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
        self._storage_path = Path(__file__).resolve().parents[2] / "database" / "notifications.json"
        self._lock = Lock()
        self._notifications = self._load()

    def _load(self) -> list[Notification]:
        try:
            records = json.loads(self._storage_path.read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError):
            return []
        return [Notification(**record) for record in records]

    def _save(self) -> None:
        self._storage_path.parent.mkdir(parents=True, exist_ok=True)
        self._storage_path.write_text(
            json.dumps([notification.to_dict() for notification in self._notifications], ensure_ascii=True),
            encoding="utf-8",
        )

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
        with self._lock:
            for existing in self._notifications:
                if (
                    existing.source == source
                    and existing.type == type
                    and existing.message == message
                    and existing.recipient == recipient
                    and existing.patient_metadata.get("patient_id") == patient_metadata.get("patient_id")
                    and existing.created_at[:19] == datetime.now(timezone.utc).isoformat()[:19]
                ):
                    return existing

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
            self._save()
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
                    self._save()
                    return notification
        return None