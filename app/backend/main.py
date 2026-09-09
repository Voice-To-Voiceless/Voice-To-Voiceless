"""Uvicorn entry point for the Voice-To-Voiceless backend."""

from app.backend.api.api import create_app

app = create_app()