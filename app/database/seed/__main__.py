from __future__ import annotations

import argparse

from sqlalchemy import select

from app.database.factories import make_link_code, make_patient
from app.database.models import Nurse, Patient, PatientLinkCode, Room
from app.database.session import session_scope


def seed_database(patient_count: int) -> list[str]:
    generated_codes: list[str] = []
    with session_scope() as session:
        nurse = session.scalar(select(Nurse).where(Nurse.full_name == "Asistenta de serviciu"))
        if nurse is None:
            nurse = Nurse(full_name="Asistenta de serviciu")
            session.add(nurse)
            session.flush()

        existing_ids = set(
            session.scalars(
                select(Patient.external_id).where(Patient.external_id.like("patient-%"))
            ).all()
        )
        for index in range(1, patient_count + 1):
            if f"patient-{index:03d}" in existing_ids:
                continue
            room_name = f"Camera {100 + index}"
            room = session.scalar(select(Room).where(Room.name == room_name))
            if room is None:
                room = Room(name=room_name)
                session.add(room)
                session.flush()

            patient = Patient(**make_patient(index, nurse_id=nurse.id, room_id=room.id))
            session.add(patient)
            session.flush()
            link_code, plain_code = make_link_code(patient.id)
            session.add(PatientLinkCode(**link_code))
            generated_codes.append(f"{patient.external_id}: {plain_code}")

    return generated_codes


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Seed PostgreSQL with fake V2VL development data.")
    parser.add_argument("--count", type=int, default=5, help="Total number of fake patients to ensure.")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if args.count < 0:
        raise SystemExit("--count must be zero or greater")

    codes = seed_database(args.count)
    print(f"Seeded development data for {args.count} patient(s).")
    for code in codes:
        print(f"Link code: {code}")


if __name__ == "__main__":
    main()
