import os
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database.models import Nurse, Notification, Patient, Room
from app.database.repositories import NotificationRepository


DATABASE_URL = os.getenv("DATABASE_URL")


@pytest.fixture
def postgres_session() -> Session:
    if not DATABASE_URL:
        pytest.skip("DATABASE_URL is required for PostgreSQL integration tests")

    engine = create_engine(DATABASE_URL)
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, autoflush=False, expire_on_commit=False)
    try:
        yield session
    finally:
        session.rollback()
        transaction.rollback()
        session.close()
        connection.close()
        engine.dispose()


def test_notification_resolves_patient_external_id(postgres_session: Session) -> None:
    patient_external_id = f"integration-{uuid4()}"
    nurse = Nurse(full_name="Integration Nurse")
    room = Room(name=f"Integration Room {uuid4()}")
    patient = Patient(
        external_id=patient_external_id,
        patient_code=f"INT-{uuid4().hex[:12]}",
        full_name="Integration Patient",
        nurse=nurse,
        room=room,
    )
    postgres_session.add(patient)
    postgres_session.flush()

    notification = NotificationRepository(postgres_session).create(
        source="patient",
        type="patient_action",
        severity="info",
        message="Integration test",
        patient_metadata={"patient_id": patient_external_id},
        recipient="nurse",
        sender_metadata={},
    )

    assert notification.patient_id == patient.id
    assert postgres_session.get(Notification, notification.id) is notification