"""
Match, scoring, leaderboard, tournament, and team models.
"""

from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


# ── Matches ───────────────────────────────────────────────────────────────────

class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    listing_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("listings.id", ondelete="RESTRICT"), nullable=True
    )
    venue_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("venues.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    booking_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True
    )
    tournament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tournaments.id", ondelete="SET NULL"), nullable=True
    )
    # casual | ranked | tournament
    match_type: Mapped[str] = mapped_column(String(20), default="casual", nullable=False, index=True)
    # solo | duo | squad | team_vs_team
    game_mode: Mapped[str] = mapped_column(String(20), default="solo", nullable=False)
    # scheduled | live | completed | cancelled | disputed
    status: Mapped[str] = mapped_column(String(20), default="scheduled", nullable=False, index=True)
    played_at: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_by_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    verified_by_admin_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    verified_at: Mapped[str] = mapped_column(String(30), default="", nullable=False)

    # ── Bracket fields (tournament knockout matches only; 0/empty otherwise) ──
    stage_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tournament_stages.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # 1 = first round within the tournament; 0 = not a bracket match
    round_number: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # slot within the round, top→bottom (0-based)
    bracket_position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    next_match_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("matches.id", ondelete="SET NULL"), nullable=True
    )
    # which side of the next match the winner advances into: "A" | "B"
    next_match_slot: Mapped[str] = mapped_column(String(1), default="", nullable=False)
    is_bye: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    scheduled_at: Mapped[str] = mapped_column(String(30), default="", nullable=False)  # ISO-8601

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    participants: Mapped[list["MatchParticipant"]] = relationship(
        "MatchParticipant", back_populates="match", cascade="all, delete-orphan"
    )


# ── Match participants ────────────────────────────────────────────────────────

class MatchParticipant(Base):
    __tablename__ = "match_participants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    match_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # A | B | none
    team: Mapped[str] = mapped_column(String(5), default="none", nullable=False)
    # player | captain | substitute
    role: Mapped[str] = mapped_column(String(20), default="player", nullable=False)
    # win | loss | draw | dnf
    result: Mapped[str] = mapped_column(String(10), default="", nullable=False)
    score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rank: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    kills: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    assists: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    deaths: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # JSON blob for sport-specific stats: {"wickets": 2, "runs": 45}
    custom_stats: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    points_earned: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_disputed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    match: Mapped["Match"] = relationship("Match", back_populates="participants")


# ── Score adjustments (admin manual overrides) ────────────────────────────────

class ScoreAdjustment(Base):
    __tablename__ = "score_adjustments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    match_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("matches.id", ondelete="SET NULL"), nullable=True
    )
    adjusted_by_admin_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    delta_points: Mapped[int] = mapped_column(Integer, nullable=False)   # can be negative
    reason: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


# ── Leaderboard snapshots (computed, not live) ────────────────────────────────

class LeaderboardSnapshot(Base):
    __tablename__ = "leaderboard_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # global | city | venue | listing | category
    scope_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    scope_id: Mapped[str] = mapped_column(String(120), default="", nullable=False, index=True)
    # all_time | monthly | weekly
    period_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    period_key: Mapped[str] = mapped_column(String(20), default="", nullable=False)   # "2026-06"
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    total_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    matches_played: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    wins: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    losses: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    draws: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


# ── Tournaments ───────────────────────────────────────────────────────────────

class Tournament(Base):
    __tablename__ = "tournaments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    listing_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("listings.id", ondelete="SET NULL"), nullable=True
    )
    venue_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("venues.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    rules: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # category slug e.g. "valorant", "cricket"
    game: Mapped[str] = mapped_column(String(60), default="", nullable=False, index=True)
    # knockout | double_elim | group_stage | group_knockout | round_robin
    format: Mapped[str] = mapped_column(String(30), default="knockout", nullable=False)
    # solo | duo | squad | team
    mode: Mapped[str] = mapped_column(String(20), default="solo", nullable=False)
    max_participants: Mapped[int] = mapped_column(Integer, default=16, nullable=False)
    entry_fee_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    prize_pool_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    prize_description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    registration_open: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    registration_deadline: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    starts_at: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    ends_at: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    # 0 = no minimum; below this at deadline → auto-cancel
    min_participants: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # finish-position points feed the leaderboard when enabled
    awards_leaderboard_points: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # draft | pending_approval | registration | live | completed | cancelled
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False, index=True)
    is_exclusive: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    banner_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    registrations: Mapped[list["TournamentRegistration"]] = relationship(
        "TournamentRegistration", back_populates="tournament", cascade="all, delete-orphan"
    )
    results: Mapped[list["TournamentResult"]] = relationship(
        "TournamentResult", back_populates="tournament", cascade="all, delete-orphan"
    )
    stages: Mapped[list["TournamentStage"]] = relationship(
        "TournamentStage", back_populates="tournament",
        order_by="TournamentStage.stage_order", cascade="all, delete-orphan"
    )


# ── Tournament stages (multi-venue support) ───────────────────────────────────

class TournamentStage(Base):
    """
    A stage is a group of rounds sharing a time window and a location.
    Single-venue tournaments have one stage; multi-venue events map stages
    to different venues (e.g. Qualifiers at Game Zone A, Finals at Game Zone B).
    Location resolution: venue_id set → venue fields; else custom
    location_name/address/lat/lng; else (future) is_online.
    """
    __tablename__ = "tournament_stages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tournament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)   # "Quarter Finals", "Group Stage"
    stage_order: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Location: partner venue OR custom location OR (future) online
    venue_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("venues.id", ondelete="SET NULL"), nullable=True
    )
    is_online: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # future-proofing
    # For non-partner locations (school ground, rented hall) or override:
    location_name: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    address: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    lat: Mapped[str] = mapped_column(String(20), default="", nullable=False)   # same convention as Venue
    lng: Mapped[str] = mapped_column(String(20), default="", nullable=False)

    starts_at: Mapped[str] = mapped_column(String(30), default="", nullable=False)  # ISO-8601
    ends_at: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)

    tournament: Mapped["Tournament"] = relationship("Tournament", back_populates="stages")


# ── Tournament admin assignments ──────────────────────────────────────────────

class TournamentAdmin(Base):
    """
    Super admin or turf owner assigns a user as match admin for a tournament.
    That user can then edit scores, verify matches, manage participants for that tournament.
    """
    __tablename__ = "tournament_admins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tournament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assigned_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class TournamentRegistration(Base):
    __tablename__ = "tournament_registrations"
    __table_args__ = (
        UniqueConstraint("tournament_id", "user_id", name="uq_tournament_registration_user"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tournament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    team_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("teams.id", ondelete="SET NULL"), nullable=True
    )
    # unpaid | paid | refunded
    payment_status: Mapped[str] = mapped_column(String(20), default="unpaid", nullable=False)
    razorpay_order_id: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    seed_number: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Match-day check-in (QR / short code shown by the player, scanned by staff)
    checked_in_at: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    checkin_code: Mapped[str] = mapped_column(String(12), default="", nullable=False, index=True)
    # Contact snapshot captured at registration time (organizer ops / CSV export)
    contact_name: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    contact_phone: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    # Squad roster snapshot: [{"user_id": int, "name": str, "phone": str}]
    roster_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    tournament: Mapped["Tournament"] = relationship("Tournament", back_populates="registrations")


class TournamentWaitlistEntry(Base):
    """
    Queue for a full tournament. On a withdrawal before the deadline the oldest
    'waiting' entry is auto-promoted into a real registration.
    (Distinct from models.waitlist.WaitlistEntry — the early-access email list.)
    """
    __tablename__ = "tournament_waitlist"
    __table_args__ = (
        UniqueConstraint("tournament_id", "user_id", name="uq_tournament_waitlist_user"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tournament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    team_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("teams.id", ondelete="SET NULL"), nullable=True
    )
    contact_name: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    contact_phone: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    roster_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    # waiting | promoted | left
    status: Mapped[str] = mapped_column(String(20), default="waiting", nullable=False)
    promoted_at: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class TournamentResult(Base):
    __tablename__ = "tournament_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tournament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    team_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("teams.id", ondelete="SET NULL"), nullable=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    points_earned: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    prize_won_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    recorded_by_admin: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    tournament: Mapped["Tournament"] = relationship("Tournament", back_populates="results")


# ── Teams ─────────────────────────────────────────────────────────────────────

class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    tag: Mapped[str] = mapped_column(String(10), default="", nullable=False)
    logo_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    leader_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    city: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("listing_categories.id", ondelete="SET NULL"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    members: Mapped[list["TeamMember"]] = relationship(
        "TeamMember", back_populates="team", cascade="all, delete-orphan"
    )
    invites: Mapped[list["TeamInvite"]] = relationship(
        "TeamInvite", back_populates="team", cascade="all, delete-orphan"
    )


class TeamMember(Base):
    __tablename__ = "team_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # leader | co_leader | member | substitute
    role: Mapped[str] = mapped_column(String(20), default="member", nullable=False)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    team: Mapped["Team"] = relationship("Team", back_populates="members")


class TeamInvite(Base):
    __tablename__ = "team_invites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    invited_email: Mapped[str] = mapped_column(String(255), nullable=False)
    invited_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # pending | accepted | declined | expired
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    invited_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    responded_at: Mapped[str] = mapped_column(String(30), default="", nullable=False)

    team: Mapped["Team"] = relationship("Team", back_populates="invites")


# ── Reviews ───────────────────────────────────────────────────────────────────

class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    venue_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("venues.id", ondelete="SET NULL"), nullable=True, index=True
    )
    listing_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("listings.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    booking_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)   # 1–5
    comment: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    is_verified_visit: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


# ── Notifications ─────────────────────────────────────────────────────────────

class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # booking_confirmed | match_recorded | tournament_result | voucher_issued
    # team_invite | score_adjusted | system | news
    type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, default="", nullable=False)
    link: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


# ── News / Content (admin pushes articles) ────────────────────────────────────

class NewsArticle(Base):
    __tablename__ = "news_articles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True, nullable=False)
    summary: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    body: Mapped[str] = mapped_column(Text, default="", nullable=False)
    cover_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    # esports | sports | general | announcement
    category: Mapped[str] = mapped_column(String(40), default="general", nullable=False, index=True)
    tags: Mapped[str] = mapped_column(String(300), default="", nullable=False)   # comma-separated
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    published_at: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    author_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    view_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
