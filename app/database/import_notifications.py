from __future__ import annotations

import argparse
from datetime import datetime
import json
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.models import Notification, Patient


class NotificationImportResult:
    def __init__(self) -> None:
        self.imported = 0
        self.skipped = 0
        self.placeholder_patients: list[str] = []


def import_notifications(session: Session, source_path: Path) -> NotificationImportResult:
    records = json.loads(source_path.read_text(encoding="utf-8"))
    result = NotificationImportResult()
    patients: dict[str, Patient] = {}

    for record in records:
        metadata = dict(record.get("patient_metadata") or {})
        external_id = metadata.get("patient_id")
        patient = None
        if external_id:
            patient = patients.get(external_id)
            if patient is None:
                patient = session.scalar(select(Patient).where(Patient.external_id == external_id))
            if patient is None:
                patient = Patient(
                    external_id=external_id,
                    patient_code=f"IMPORT-{external_id}"[:20],
                    full_name=metadata.get("name") or f"Imported {external_id}",
                    details="Placeholder created while importing legacy notifications",
                )
                session.add(patient)
                session.flush()
                result.placeholder_patients.append(external_id)
            patients[external_id] = patient

        notification_id = UUID(record["id"])
        if session.get(Notification, notification_id) is not None:
            result.skipped += 1
            continue

        created_at = datetime.fromisoformat(record["created_at"].replace("Z", "+00:00"))
        session.add(
            Notification(
                id=notification_id,
                source=record["source"],
                type=record["type"],
                severity=record["severity"],
                message=record["message"],
                patient_id=patient.id if patient else None,
                patient_metadata=metadata,
                sender_metadata=dict(record.get("sender_metadata") or {}),
                recipient=record.get("recipient", "nurse"),
                read=bool(record.get("read", False)),
                created_at=created_at,
            )
        )
        result.imported += 1

    return result


def import_from_default_fixture(session: Session) -> NotificationImportResult:
    fixture = Path(__file__).resolve().parent / "notifications.json"
    return import_notifications(session, fixture)


def main() -> None:
    parser = argparse.ArgumentParser(description="Import legacy notification JSON into PostgreSQL.")
    parser.add_argument(
        "--path",
        type=Path,
        default=Path(__file__).resolve().parent / "notifications.json",
        help="Path to the notification JSON fixture.",
    )
    args = parser.parse_args()

    from app.database.session import session_scope

    with session_scope() as session:
        result = import_notifications(session, args.path)

    print(f"Imported {result.imported} notification(s); skipped {result.skipped} existing record(s).")
    if result.placeholder_patients:
        print("Placeholder patients: " + ", ".join(result.placeholder_patients))


if __name__ == "__main__":
    main()
