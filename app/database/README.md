# Database

The database layer uses PostgreSQL, SQLAlchemy, and Alembic. All Python dependencies are managed by the `uv` project in `app/`.

## Setup

### Docker

From the repository root, start PostgreSQL and the backend containers:

```powershell
docker compose -f app/docker-compose.yml up --build
```

The backend is available at `http://localhost:8000`. PostgreSQL is available to the backend as `db:5432` and to host tools such as DBeaver as `localhost:5434`.

Stop the containers with:

```powershell
docker compose -f app/docker-compose.yml down
```

Add `-v` to the `down` command only when you intentionally want to delete the PostgreSQL development volume.

From the repository root:

```powershell
uv sync --project app
```

Copy `app/.env.example` to `app/.env` for host-based tools such as DBeaver. Use `localhost:5434` from the host; the backend container uses `db:5432` through the Docker network.

Apply migrations:

```powershell
uv run --project app alembic -c app/database/alembic.ini upgrade head
```

## Development data

Create one development nurse and the requested total number of patients:

```powershell
uv run --project app python -m app.database.seed --count 10
```

The command is repeatable and only creates missing fake patients. Each new patient receives a room, a nurse assignment, and a one-time link code. Link codes are printed once when generated.

Import the legacy notification fixture:

```powershell
uv run --project app python -m app.database.import_notifications
```

Use `--path` to import another JSON fixture. Existing notification IDs are skipped, so the import can be safely repeated.

## Schema

- `nurse` to `patient` is one-to-many (`N:1` from patient to nurse).
- `room` is a reusable room record referenced by `patient.room_id`.
- `patient_link_code` stores only a SHA-256 hash, plus expiry and consumption timestamps.
- `notification` stores the normalized patient foreign key and the existing metadata objects as PostgreSQL `JSONB`.

`patient.nurse_id` is nullable so imported placeholder patients can exist before assignment. Seed-created patients are always assigned to the development nurse.
