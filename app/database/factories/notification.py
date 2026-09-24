from typing import Any


def make_notification(patient_id: str, *, message: str = "Development notification") -> dict[str, Any]:
    return {
        "source": "patient",
        "type": "patient_action",
        "severity": "info",
        "message": message,
        "patient_metadata": {"patient_id": patient_id},
        "sender_metadata": {},
        "recipient": "nurse",
        "read": False,
    }
