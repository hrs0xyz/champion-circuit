from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import auth, health, uploads, users, vouchers
from app.core.config import settings
from app.db.migrations import ensure_dev_schema
from app.db.session import Base, engine
from app.models import voucher as _voucher_model  # noqa: F401 — ensures table is created
from app.models import waitlist as _waitlist_model  # noqa: F401

Base.metadata.create_all(bind=engine)
ensure_dev_schema()
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

app = FastAPI(title=settings.APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(uploads.router, prefix="/api/uploads", tags=["uploads"])
app.include_router(vouchers.router, prefix="/api", tags=["vouchers"])
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")
