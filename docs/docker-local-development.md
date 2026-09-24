# Local Development with Docker

This guide explains how to run the PostgreSQL database and Python backend locally with Docker on Windows.

## Architecture

The local environment uses two containers:

- `db`: PostgreSQL 16
- `backend`: FastAPI, SQLAlchemy, Alembic, and the application services

The containers communicate through the Docker Compose network:

```text
backend -> db:5432
```

The PostgreSQL container is also exposed to the Windows host for tools such as DBeaver:

```text
Windows host localhost:5434 -> PostgreSQL container:5432
```

Port `5434` is used because PostgreSQL is already running on port `5432` on Windows.

## Prerequisites

Install and start Docker Desktop for Windows. Verify that the Docker engine is running:

```powershell
docker version
```

The project uses `uv` for the Python environment and dependencies. Install `uv` if you also want to run backend commands outside Docker:

```powershell
uv --version
```

## Configuration

The Docker Compose configuration is in:

```text
app/docker-compose.yml
```

The development database uses these local credentials:

```text
Database: v2vl
Username: postgres
Password: postgres
```

These credentials are for local development only.

For host-based tools, copy the environment template:

```powershell
Copy-Item app/.env.example app/.env
```

The host connection URL is:

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5434/v2vl
```

The backend container must use the Compose service name and the container port instead:

```text
postgresql+psycopg://postgres:postgres@db:5432/v2vl
```

Do not use `db:5434` inside the backend container. Port `5434` exists only on the Windows host.

## Start the environment

Run these commands from the repository root:

```powershell
docker compose -f app/docker-compose.yml up --build
```

To run the containers in the background:

```powershell
docker compose -f app/docker-compose.yml up --build -d
```

The backend waits until PostgreSQL passes its health check, applies the Alembic migrations, and starts Uvicorn.

Services:

- Backend API: <http://localhost:8000>
- API documentation: <http://localhost:8000/docs>
- Health check: <http://localhost:8000/health>
- PostgreSQL from Windows: `localhost:5434`

Check container status:

```powershell
docker compose -f app/docker-compose.yml ps
```

View backend logs:

```powershell
docker compose -f app/docker-compose.yml logs -f backend
```

View PostgreSQL logs:

```powershell
docker compose -f app/docker-compose.yml logs -f db
```

## Apply migrations manually

The backend startup applies migrations automatically. To apply them manually inside the backend container:

```powershell
docker compose -f app/docker-compose.yml exec backend `
  uv run --project app --no-sync alembic `
  -c app/database/alembic.ini upgrade head
```

Check the current migration version:

```powershell
docker compose -f app/docker-compose.yml exec backend `
  uv run --project app --no-sync alembic `
  -c app/database/alembic.ini current
```

## Seed development data

Create or complete a development dataset with 10 patients:

```powershell
docker compose -f app/docker-compose.yml exec backend `
  uv run --project app --no-sync python `
  -m app.database.seed --count 10
```

The seeder creates:

- one development nurse;
- the requested number of fake patients;
- one room for each generated patient;
- one nurse assignment per patient;
- one expiring link code per new patient.

The command is repeatable. `--count 10` means that patients `patient-001` through `patient-010` should exist. Existing patients are not duplicated.

The generated plain link codes are printed once by the command. Store them for development use because only their hashes are saved in PostgreSQL.

Verify the number of patients:

```powershell
docker compose -f app/docker-compose.yml exec db `
  psql -U postgres -d v2vl `
  -c "SELECT COUNT(*) AS patient_count FROM public.patient;"
```

List the seeded patients:

```powershell
docker compose -f app/docker-compose.yml exec db `
  psql -U postgres -d v2vl `
  -c "SELECT external_id, patient_code, full_name FROM public.patient ORDER BY external_id;"
```

## Import legacy notifications

Import the existing JSON fixture into PostgreSQL:

```powershell
docker compose -f app/docker-compose.yml exec backend `
  uv run --project app --no-sync python `
  -m app.database.import_notifications
```

The importer is safe to repeat because existing notification IDs are skipped.

## Connect with DBeaver

Create a PostgreSQL connection with:

```text
Host: localhost
Port: 5434
Database: v2vl
Username: postgres
Password: postgres
Schema: public
```

Test the connection with:

```sql
SELECT current_database(), current_user;

SELECT external_id, patient_code, full_name
FROM public.patient
ORDER BY external_id;
```

After seeding, refresh the DBeaver connection and the `public` schema if the table data grid appears empty.

## Stop the environment

Stop containers but keep the database volume:

```powershell
docker compose -f app/docker-compose.yml down
```

Stop containers and delete all local PostgreSQL data:

```powershell
docker compose -f app/docker-compose.yml down -v
```

Use `down -v` only when you intentionally want to recreate the database from scratch. The `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` values are applied when the PostgreSQL volume is initialized. Changing them later does not recreate an existing database.

## Troubleshooting

### Backend cannot connect to PostgreSQL

Check that the backend URL uses the internal service name and port:

```text
postgresql+psycopg://postgres:postgres@db:5432/v2vl
```

If the URL contains `db:5434`, change it to `db:5432`.

Check the service health:

```powershell
docker compose -f app/docker-compose.yml ps
```

### Database `v2vl` does not exist

This can happen when an existing PostgreSQL volume was initialized before `POSTGRES_DB=v2vl` was configured. Create the database without deleting the volume:

```powershell
docker compose -f app/docker-compose.yml exec db `
  psql -U postgres -d postgres `
  -c "SELECT 'CREATE DATABASE v2vl' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'v2vl')\gexec"
```

Alternatively, recreate the development database volume:

```powershell
docker compose -f app/docker-compose.yml down -v
docker compose -f app/docker-compose.yml up --build -d
```

### Port 5434 is already in use

Find the process using the host port:

```powershell
Get-NetTCPConnection -LocalPort 5434 -ErrorAction SilentlyContinue
```

Either stop that process or change only the host side of the mapping in `app/docker-compose.yml`, for example:

```yaml
ports:
  - "5435:5432"
```

Then use the new host port in DBeaver. Keep the backend URL as `db:5432`.

### The patient table appears empty in DBeaver

First verify the data through SQL:

```sql
SELECT COUNT(*) FROM public.patient;
```

Then refresh the connection, refresh the `public` schema, and reopen **View Data > All Rows** for `public.patient`. Confirm that DBeaver uses port `5434`, not the Windows PostgreSQL instance on port `5432`.

### The seeder reports success but no patients appear

Run the seeder inside the backend container so it uses the same database as the application:

```powershell
docker compose -f app/docker-compose.yml exec backend `
  uv run --project app --no-sync python `
  -m app.database.seed --count 10
```

Then query the database through the `db` container or DBeaver on `localhost:5434`.
