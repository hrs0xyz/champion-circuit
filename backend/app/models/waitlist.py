from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class WaitlistEntry(Base):
    """Early-access waitlist — one entry per email."""
    __tablename__ = "waitlist_entries"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    voucher_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    benefit: Mapped[str] = mapped_column(String(200), default="₹200 off your first booking", nullable=False)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
