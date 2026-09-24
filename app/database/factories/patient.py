from typing import Any
from uuid import UUID


def make_patient(index: int, *, nurse_id: UUID | None = None, room_id: UUID | None = None) -> dict[str, Any]:
    return {
        "external_id": f"patient-{index:03d}",
        "patient_code": f"PAT-{index:04d}",
        "full_name": f"Development Patient {index}",
        "details": "Development test patient",
        "nurse_id": nurse_id,
        "room_id": room_id,
    }
