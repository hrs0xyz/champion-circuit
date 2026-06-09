# Champion Circuit Backend

FastAPI backend for Champion Circuit. It starts as a modular monolith: one deployable app with clear package boundaries for API routes, core config, database, models, schemas, and services.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

API docs run at `http://localhost:8000/docs`.

