from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import admin, auth, health, matches, uploads, users, venues, vouchers
from app.core.config import settings
from app.db.migrations import ensure_dev_schema
from app.db.session import Base, engine

# ── Import all models so SQLAlchemy registers them before create_all ──────────
from app.models import user as _user_model          # noqa: F401
from app.models import venue as _venue_model        # noqa: F401
from app.models import match as _match_model        # noqa: F401
from app.models import voucher as _voucher_model    # noqa: F401
from app.models import waitlist as _waitlist_model  # noqa: F401

# ── Create all tables (idempotent) ────────────────────────────────────────────
Base.metadata.create_all(bind=engine)
ensure_dev_schema()  # add missing columns to existing SQLite DBs

# ── Ensure upload directories exist ──────────────────────────────────────────
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
Path(settings.UPLOAD_DIR, "listings").mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title=settings.APP_NAME,
    version="2.0.0",
    description="Champion Circuit API — Sports + Esports + Vouchers",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"http://127\.0\.0\.1:\d+|http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(health.router,   prefix="/api",          tags=["health"])
app.include_router(auth.router,     prefix="/api/auth",     tags=["auth"])
app.include_router(users.router,    prefix="/api/users",    tags=["users"])
app.include_router(uploads.router,  prefix="/api/uploads",  tags=["uploads"])
app.include_router(venues.router,   prefix="/api",          tags=["venues"])
app.include_router(matches.router,  prefix="/api",          tags=["matches & tournaments"])
app.include_router(vouchers.router, prefix="/api",          tags=["vouchers"])
app.include_router(admin.router,    prefix="/api",          tags=["staff portal"])

# ── Static file serving ───────────────────────────────────────────────────────
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")
