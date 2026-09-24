# Local Development Quick Start

Use these steps on Windows to start the V2VL app locally.

## 1. Install the required tools

Install and start **Docker Desktop**.

Install **Node.js 22 or newer**.

Open PowerShell and check that both tools work:

```powershell
docker --version
node --version
npm --version
```

## 2. Open the project folder

In PowerShell, go to the project folder:

```powershell
cd C:\Projects\V2VL
```

## 3. Start the database and backend

Run this command:

```powershell
docker compose -f app/docker-compose.yml up --build -d
```

Wait until the containers are running. Check them with:

```powershell
docker compose -f app/docker-compose.yml ps
```

You should see the `db` and `backend` services running.

The backend is now available at:

- API: http://localhost:8000
- API documentation: http://localhost:8000/docs
- Health check: http://localhost:8000/health

## 4. Add sample patients

This step creates sample data for local testing:

```powershell
docker compose -f app/docker-compose.yml exec backend uv run --project app --no-sync python -m app.database.seed --count 10
```

You can run this command again later. It will not create duplicate patients.

## 5. Start the web app

Open a **second PowerShell window** and run:

```powershell
cd C:\Projects\V2VL\app\frontend
npm install
npm run start:web
```

Open the address shown in the terminal. It is usually:

http://localhost:5173

Keep this terminal window open while using the web app.

## 6. Stop the app

In the Docker terminal, run:

```powershell
cd C:\Projects\V2VL
docker compose -f app/docker-compose.yml down
```

This stops the containers and keeps your local database data.

To start the app again later:

```powershell
cd C:\Projects\V2VL
docker compose -f app/docker-compose.yml up -d
```

Stop the frontend by pressing `Ctrl+C` in the frontend terminal.

## Common problems

### Docker is not running

Start Docker Desktop and wait until it says Docker is running. Then repeat the Docker command.

### The web page does not open

Make sure the frontend terminal is still running `npm run start:web`. Also check that you are opening the URL printed by Vite.

### The backend is not ready

Check the backend logs:

```powershell
docker compose -f app/docker-compose.yml logs backend
```

### Start from a completely empty database

This deletes all local PostgreSQL data:

```powershell
docker compose -f app/docker-compose.yml down -v
docker compose -f app/docker-compose.yml up --build -d
```

Only use this when you intentionally want to reset the local database.

For advanced setup, database access, DBeaver, migrations, and troubleshooting, see [docker-local-development.md](docker-local-development.md).
