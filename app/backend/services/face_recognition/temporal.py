"""Temporal processing for face blendshape observations."""

from dataclasses import dataclass, field


@dataclass
class BlendshapeSmoother:
	"""Apply exponential smoothing to blendshape scores."""

	alpha: float = 0.35
	_values: dict[str, float] = field(default_factory=dict, init=False)

	def __post_init__(self) -> None:
		if not 0.0 < self.alpha <= 1.0:
			raise ValueError("alpha must be greater than 0 and at most 1")

	def update(self, scores: dict[str, float]) -> dict[str, float]:
		"""Return smoothed scores while preserving the known feature names."""
		for name, value in scores.items():
			previous = self._values.get(name, value)
			self._values[name] = previous + self.alpha * (value - previous)
		return dict(self._values)

	def reset(self) -> None:
		"""Forget the previous frame values."""
		self._values.clear()