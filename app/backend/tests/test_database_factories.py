from uuid import uuid4

from app.database.factories import make_link_code, make_nurse, make_notification, make_patient, make_room
from app.database.seed.__main__ import build_parser


def test_factories_create_valid_development_records() -> None:
    patient_id = uuid4()
    nurse_id = uuid4()
    room_id = uuid4()

    assert make_nurse(1)["full_name"] == "Asistenta de serviciu"
    assert make_room(2)["name"] == "Camera 102"
    assert make_patient(2, nurse_id=nurse_id, room_id=room_id)["patient_code"] == "PAT-0002"
    assert make_notification(str(patient_id))["patient_metadata"] == {"patient_id": str(patient_id)}

    link_code, plain_code = make_link_code(patient_id)
    assert len(plain_code) == 10
    assert link_code["patient_id"] == patient_id
    assert link_code["code_hash"] != plain_code


def test_seed_parser_supports_count() -> None:
    args = build_parser().parse_args(["--count", "12"])

    assert args.count == 12
