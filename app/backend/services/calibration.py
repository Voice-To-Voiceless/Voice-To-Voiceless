"""Persistence and server-side validation for browser calibration profiles."""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import math
from uuid import UUID

from sqlalchemy import select

from app.database.models import CalibrationProfile, Patient
from app.database.repositories import CalibrationProfileRepository
from app.database.session import session_scope

MINIMUM_SCORE = 55
MAX_VALIDATION_RMS = 0.15
SCORE_VERSION = 1
PAYLOAD_VERSION = 1


def canonical_setup_key(setup_metadata: dict[str, object]) -> str:
    payload = json.dumps(setup_metadata, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _profile_to_dict(profile: CalibrationProfile) -> dict[str, object]:
    return {
        "id": str(profile.id),
        "patient_id": str(profile.patient_id),
        "installation_id": str(profile.installation_id),
        "setup_key": profile.setup_key,
        "engine": profile.engine,
        "engine_version": profile.engine_version,
        "payload_version": profile.payload_version,
        "score_version": profile.score_version,
        "accuracy_score": profile.accuracy_score,
        "validation_rms": profile.validation_rms,
        "validation_p95": profile.validation_p95,
        "training_data": profile.training_data,
        "setup_metadata": profile.setup_metadata,
        "pose_reference": profile.pose_reference,
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
        "last_verified_at": profile.last_verified_at.isoformat() if profile.last_verified_at else None,
        "last_verification_score": profile.last_verification_score,
    }


def calculate_validation_diagnostics(samples: object) -> dict[str, float | int]:
    """Validate held-out samples and calculate the persisted quality score."""
    if not isinstance(samples, list) or not samples:
        raise ValueError("validation samples are required")
    errors: list[float] = []
    counts: dict[int, int] = {}
    for sample in samples:
        if not isinstance(sample, dict) or not sample.get("accepted", True):
            continue
        prediction = sample.get("prediction")
        target = sample.get("target")
        target_index = sample.get("target_index")
        if not isinstance(prediction, dict) or not isinstance(target, dict) or not isinstance(target_index, int):
            raise ValueError("invalid validation sample")
        values = [prediction.get("x"), prediction.get("y"), target.get("x"), target.get("y")]
        if not all(isinstance(value, (int, float)) and math.isfinite(value) for value in values):
            raise ValueError("validation diagnostics must be finite")
        error = math.hypot(prediction["x"] - target["x"], prediction["y"] - target["y"])
        errors.append(error)
        counts[target_index] = counts.get(target_index, 0) + 1
    if len(counts) != 9 or any(counts.get(target_index, 0) < 20 for target_index in range(9)):
        raise ValueError("validation must cover nine targets with sufficient samples")
    rms = math.sqrt(sum(error * error for error in errors) / len(errors))
    if rms > MAX_VALIDATION_RMS:
        raise ValueError("validation RMS exceeds the allowed limit")
    ordered = sorted(errors)
    p95 = ordered[max(0, math.ceil(len(ordered) * 0.95) - 1)]
    score = round(100 * max(0, min(1, 1 - p95 / 0.30)))
    if score < MINIMUM_SCORE:
        raise ValueError("calibration score is below the minimum")
    return {"rms": rms, "p95": p95, "score": score}


class CalibrationProfileService:
    def get(self, patient_public_id: str, installation_id: UUID, setup_key: str) -> dict[str, object] | None:
        with session_scope() as session:
            patient = self._find_patient(session, patient_public_id)
            if patient is None:
                return None
            profile = CalibrationProfileRepository(session).get(patient.id, installation_id, setup_key)
            return _profile_to_dict(profile) if profile else None

    def save(self, patient_public_id: str, installation_id: UUID, payload: dict[str, object]) -> tuple[str, dict[str, object]]:
        setup_metadata = payload["setup_metadata"]
        if not isinstance(setup_metadata, dict) or canonical_setup_key(setup_metadata) != payload["setup_key"]:
            raise ValueError("setup_key does not match setup_metadata")
        diagnostics = self._calculate_diagnostics(payload["validation_samples"])
        submitted_score = payload["accuracy_score"]
        if diagnostics["score"] != submitted_score:
            raise ValueError("accuracy_score does not match validation samples")

        with session_scope() as session:
            patient = self._find_patient(session, patient_public_id)
            if patient is None:
                raise LookupError("Patient not found")
            repository = CalibrationProfileRepository(session)
            existing = repository.get_for_update(patient.id, installation_id, payload["setup_key"])
            compatible = existing is not None and (
                existing.engine == payload["engine"]
                and existing.engine_version == payload["engine_version"]
                and existing.payload_version == payload["payload_version"]
                and existing.score_version == payload["score_version"]
            )
            if compatible and existing.accuracy_score >= submitted_score:
                return "kept_existing", _profile_to_dict(existing)
            profile = existing or CalibrationProfile(patient_id=patient.id, installation_id=installation_id, setup_key=payload["setup_key"])
            profile.engine = payload["engine"]
            profile.engine_version = payload["engine_version"]
            profile.payload_version = payload["payload_version"]
            profile.score_version = payload["score_version"]
            profile.accuracy_score = submitted_score
            profile.validation_rms = diagnostics["rms"]
            profile.validation_p95 = diagnostics["p95"]
            profile.training_data = payload["training_data"]
            profile.setup_metadata = setup_metadata
            profile.pose_reference = payload["pose_reference"]
            repository.save(profile) if existing is None else session.flush()
            return ("replaced" if existing else "created"), _profile_to_dict(profile)

    def delete(self, patient_public_id: str, installation_id: UUID, setup_key: str) -> bool:
        with session_scope() as session:
            patient = self._find_patient(session, patient_public_id)
            if patient is None:
                return False
            profile = CalibrationProfileRepository(session).get_for_update(patient.id, installation_id, setup_key)
            if profile is None:
                return False
            session.delete(profile)
            return True

    def verify(self, patient_public_id: str, installation_id: UUID, setup_key: str, score: int) -> dict[str, object] | None:
        with session_scope() as session:
            patient = self._find_patient(session, patient_public_id)
            if patient is None:
                return None
            profile = CalibrationProfileRepository(session).get_for_update(patient.id, installation_id, setup_key)
            if profile is None:
                return None
            profile.last_verified_at = datetime.now(timezone.utc)
            profile.last_verification_score = score
            session.flush()
            return _profile_to_dict(profile)

    @staticmethod
    def _find_patient(session, public_id: str) -> Patient | None:
        try:
            patient_uuid = UUID(public_id)
        except ValueError:
            patient_uuid = None
        query = select(Patient).where(Patient.external_id == public_id)
        if patient_uuid is not None:
            query = query.where((Patient.external_id == public_id) | (Patient.id == patient_uuid))
        return session.scalar(query)

    @staticmethod
    def _calculate_diagnostics(samples: object) -> dict[str, float | int]:
        return calculate_validation_diagnostics(samples)