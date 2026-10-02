from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.models import CalibrationProfile


class CalibrationProfileRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, patient_id: UUID, installation_id: UUID, setup_key: str) -> CalibrationProfile | None:
        return self.session.scalar(
            select(CalibrationProfile).where(
                CalibrationProfile.patient_id == patient_id,
                CalibrationProfile.installation_id == installation_id,
                CalibrationProfile.setup_key == setup_key,
            )
        )

    def get_for_update(self, patient_id: UUID, installation_id: UUID, setup_key: str) -> CalibrationProfile | None:
        return self.session.scalar(
            select(CalibrationProfile).where(
                CalibrationProfile.patient_id == patient_id,
                CalibrationProfile.installation_id == installation_id,
                CalibrationProfile.setup_key == setup_key,
            ).with_for_update()
        )

    def save(self, profile: CalibrationProfile) -> CalibrationProfile:
        self.session.add(profile)
        self.session.flush()
        return profile