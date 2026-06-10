from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=True)
    # password | google
    auth_provider: Mapped[str] = mapped_column(String(32), default="password", nullable=False)

    # Profile
    name: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    # male | female | non_binary | prefer_not_to_say
    gender: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    date_of_birth: Mapped[str] = mapped_column(String(10), default="", nullable=False)  # YYYY-MM-DD
    phone: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    avatar_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    photo_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    bio: Mapped[str] = mapped_column(Text, default="", nullable=False)

    city: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    state: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    country: Mapped[str] = mapped_column(String(60), default="India", nullable=False)
    postal_code: Mapped[str] = mapped_column(String(20), default="", nullable=False)

    # JSON arrays stored as text
    interests: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    ranked_interests: Mapped[str] = mapped_column(Text, default="[]", nullable=False)

    # Roles & status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_venue_owner: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Profile edit rate-limit
    profile_edit_date: Mapped[str] = mapped_column(String(10), default="", nullable=False)
    profile_edits_today: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class EmailOtp(Base):
    __tablename__ = "email_otps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    otp_code: Mapped[str] = mapped_column(String(6), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
