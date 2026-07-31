# from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from app.api.routes import admin, auth, health, matches, reviews, uploads, users, venues, vouchers, activity
from app.core.config import settings
from app.db.migrations import ensure_dev_schema
from app.db.session import Base, engine
from app.services.email_service import get_email_service
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    # Startup - use print() since logging may not be configured yet
    print("=== Champion Circuit API Starting Up ===")
    
    # Log current working directory and file structure
    import os
    cwd = os.getcwd()
    print(f"Current working directory: {cwd}")
    
    # Check templates directory
    templates_dir = Path(__file__).parent / "templates" / "email"
    abs_templates = templates_dir.absolute()
    print(f"Templates directory path: {abs_templates}")
    print(f"Templates directory exists: {templates_dir.exists()}")
    
    if templates_dir.exists():
        template_files = sorted([f.name for f in templates_dir.glob("*.html")])
        print(f"Found {len(template_files)} templates: {template_files}")
    else:
        print(f"Templates directory NOT FOUND at: {abs_templates}")
        # Try alternate locations
        alt_path1 = Path(cwd) / "app" / "templates" / "email"
        alt_path2 = Path(cwd) / "backend" / "app" / "templates" / "email"
        print(f"Checking alternate path 1: {alt_path1} exists={alt_path1.exists()}")
        print(f"Checking alternate path 2: {alt_path2} exists={alt_path2.exists()}")
    
    # Initialize email service and verify templates
    try:
        email_service = get_email_service()
        # Force initialization to check templates
        jinja_env = email_service.jinja_env
        
        if jinja_env:
            available = jinja_env.list_templates()
            print(f"✅ Email service initialized - Jinja2 sees {len(available)} templates: {sorted(available)}")
        else:
            print("❌ Email service Jinja2 environment is None!")
            
        print("✅ Email service initialized successfully")
    except Exception as e:
        print(f"❌ Email service initialization failed: {e}")
        import traceback
        traceback.print_exc()
    
    print("=== Startup Complete ===")
    
    yield  # Application runs here
    
    # Shutdown (if needed)
    print("=== Shutting down ===")


# ── Import all models so SQLAlchemy registers them before create_all ──────────
from app.models import user as _user_model          # noqa: F401
from app.models import venue as _venue_model        # noqa: F401
from app.models import match as _match_model        # noqa: F401
from app.models import voucher as _voucher_model    # noqa: F401
from app.models import waitlist as _waitlist_model  # noqa: F401
from app.models import activity as _activity_model  # noqa: F401



# ── Create all tables (idempotent) ────────────────────────────────────────────
Base.metadata.create_all(bind=engine)
ensure_dev_schema()  # add missing columns to existing SQLite DBs

# ── Ensure upload directories exist ──────────────────────────────────────────
# Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
# Path(settings.UPLOAD_DIR, "listings").mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title=settings.APP_NAME,
    version="2.0.0",
    description="Champion Circuit API — Sports + Esports + Vouchers",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
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
app.include_router(reviews.router,  prefix="/api",          tags=["reviews"])
app.include_router(activity.router, prefix="/api",          tags=["activity"])

# ── Static file serving ───────────────────────────────────────────────────────
# app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")
