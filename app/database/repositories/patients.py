from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database.models import Patient


class PatientRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list(self) -> list[Patient]:
        query = select(Patient).options(joinedload(Patient.room)).order_by(Patient.full_name)
        return list(self.session.scalars(query))