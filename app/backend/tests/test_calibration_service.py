import pytest

from app.backend.services.calibration import calculate_validation_diagnostics


def samples_for_error(error: float) -> list[dict[str, object]]:
    return [
        {
            "prediction": {"x": target_x + error, "y": target_y},
            "target": {"x": target_x, "y": target_y},
            "target_index": target_index,
        }
        for target_index, (target_x, target_y) in enumerate([(x, y) for y in (0.1, 0.5, 0.9) for x in (0.1, 0.5, 0.9)])
        for _ in range(20)
    ]


@pytest.mark.parametrize(("error", "expected_score"), [(0.138, 54), (0.135, 55), (0.132, 56)])
def test_score_boundary(error: float, expected_score: int) -> None:
    samples = samples_for_error(error)
    if expected_score < 55:
        with pytest.raises(ValueError, match="below the minimum"):
            calculate_validation_diagnostics(samples)
    else:
        assert calculate_validation_diagnostics(samples)["score"] == expected_score


def test_validation_requires_every_target() -> None:
    samples = samples_for_error(0.1)
    samples = [sample for sample in samples if sample["target_index"] != 8]
    with pytest.raises(ValueError, match="nine targets"):
        calculate_validation_diagnostics(samples)