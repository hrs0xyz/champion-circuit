"""
UserActivity — tracks user interactions for analytics and targeted promotions.
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from app.db.session import Base


class UserActivity(Base):
    __tablename__ = "user_activity"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    username = Column(String(40), default="")

    # What happened
    event = Column(String(60), nullable=False, index=True)
    # Events: venue_view, listing_inquiry, sport_filter, city_filter, voucher_view, voucher_purchase, booking

    # Context
    venue_id = Column(Integer, nullable=True, index=True)
    venue_name = Column(String(200), default="")
    sport = Column(String(60), default="")     # sport slug, e.g. "badminton"
    city = Column(String(120), default="")
    listing_id = Column(Integer, nullable=True)
    listing_title = Column(String(200), default="")
    extra = Column(String(500), default="")    # JSON blob for any extra context

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
