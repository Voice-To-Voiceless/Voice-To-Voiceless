# Backend Documentation

The backend is a FastAPI service that exposes patient linking, notification management, health, and WebSocket endpoints. It is designed around injectable application services so API behavior can be tested without requiring the default service construction.

## Structure

| Path | Responsibility |
| --- | --- |
| `app/backend/main.py` | Uvicorn import entry point |
| `app/backend/api/api.py` | FastAPI app factory, CORS, REST routes, and WebSocket routes |
| `app/backend/core/core.py` | Composition root and `ApplicationServices` dependency container |
| `app/backend/services/patient.py` | Patient listing and link-code lookup |
| `app/backend/services/notification.py` | Notification creation, querying, read state, and deletion |
| `app/backend/services/face_recognition/` | Face detection and temporal interpretation services |
| `app/backend/services/eye_tracking/` | Backend eye-tracking service boundary |
| `app/backend/services/language_interpreter/` | Sign-language model and English translation contracts |
| `app/backend/tests/` | Persistence and factory tests |

## API

The interactive OpenAPI page is available at `http://localhost:8000/docs` when the server is running.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Return service health |
| `GET` | `/api/v1/patients` | List patient summaries |
| `POST` | `/api/v1/patients/link` | Link a patient using a code |
| `POST` | `/api/v1/notifications` | Create a notification from a client |
| `POST` | `/api/v1/nurse/alerts` | Send a nurse alert to a patient |
| `GET` | `/api/v1/notifications` | List notifications, optionally filtered by recipient/read state |
| `POST` | `/api/v1/notifications/{notification_id}/read` | Mark a notification as read |
| `DELETE` | `/api/v1/notifications/{notification_id}` | Delete a notification |
| `WebSocket` | `/api/v1/notifications/ws` | Receive broadcast notifications; optional `recipient` filter |

Notification payloads contain a source, type, severity, message, recipient, read state, timestamps, and optional patient/sender metadata. The API uses Pydantic request models with minimum-length validation for required strings.

## Runtime flow

`create_app()` builds the FastAPI instance and either uses injected `ApplicationServices` or creates the default services. REST handlers delegate persistence to those services. When a notification is created or marked read, connected WebSocket clients receive the serialized notification, subject to their recipient filter.

The current WebSocket implementation is an in-process connection registry. It is appropriate for local development and a single backend process. A multi-worker deployment would need a shared pub/sub mechanism to broadcast across workers.

## Configuration and startup

The project uses `uv` and requires Python 3.11 or newer.

```powershell
uv sync --project app
uv run --project app python -m uvicorn app.backend.main:app --reload --host 0.0.0.0 --port 8000
```

With Docker Compose, the backend waits for PostgreSQL, applies Alembic migrations, and starts Uvicorn automatically:

```powershell
docker compose -f app/docker-compose.yml up --build
```

The API enables CORS for the local Vite origins `http://localhost:5173` and `http://127.0.0.1:5173`. Production deployments should replace this allowlist with the deployed frontend origins.

## Tests

Backend tests are run from the repository root after installing the project environment:

```powershell
uv run --project app pytest
```

The language interpreter currently exposes an `UnconfiguredSignLanguageModel` extension point. Inject a configured model implementation through the application composition root before enabling real sign-language predictions.