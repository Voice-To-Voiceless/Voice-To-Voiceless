FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /workspace

COPY pyproject.toml uv.lock ./app/
RUN uv sync --project app --frozen --no-dev

COPY . ./app/

EXPOSE 8000

CMD ["sh", "-c", "uv run --project app --no-sync alembic -c app/database/alembic.ini upgrade head && uv run --project app --no-sync uvicorn app.backend.main:app --host 0.0.0.0 --port 8000"]
