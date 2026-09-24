from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from typing import Any
from uuid import UUID


def make_link_code(patient_id: UUID, *, lifetime_minutes: int = 15) -> tuple[dict[str, Any], str]:
    plain_code = secrets.token_hex(5).upper()
    record = {
        "patient_id": patient_id,
        "code_hash": hashlib.sha256(plain_code.encode("utf-8")).hexdigest(),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=lifetime_minutes),
    }
    return record, plain_code
