"""Translation contracts for converting interpreted signs to English."""

from typing import Protocol


class EnglishTranslator(Protocol):
	"""Adapter contract for translation from interpreted sign labels."""

	def translate(self, sign_label: str) -> str:
		"""Convert one interpreted sign label to English text."""


class GlossaryEnglishTranslator:
	"""Small deterministic translator used until a language model is added."""

	def __init__(self, glossary: dict[str, str] | None = None) -> None:
		self._glossary = glossary or {
			"hello": "Hello",
			"help": "I need help",
			"yes": "Yes",
			"no": "No",
			"thank_you": "Thank you",
			"unknown": "",
		}

	def translate(self, sign_label: str) -> str:
		return self._glossary.get(sign_label.lower(), sign_label.replace("_", " "))