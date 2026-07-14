from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime


# ── Match ─────────────────────────────────────────────────────────────────────

class ParticipantCreate(BaseModel):
    user_id: int
    team: str = Field(default="none", max_length=5)
    role: str = Field(default="player", max_length=20)
    result: str = Field(default="", max_length=10)
    score: int = Field(default=0, ge=0)
    rank: int = Field(default=0, ge=0)
    kills: int = Field(default=0, ge=0)
    assists: int = Field(default=0, ge=0)
    deaths: int = Field(default=0, ge=0)
    custom_stats: str = Field(default="{}", max_length=2000)


class MatchCreate(BaseModel):
    venue_id: int
    listing_id: int = 0
    booking_id: int = 0
    tournament_id: int = 0
    match_type: str = Field(default="casual", max_length=20)
    game_mode: str = Field(default="solo", max_length=20)
    played_at: str = Field(default="", max_length=30)
    duration_minutes: int = Field(default=0, ge=0)
    notes: str = Field(default="", max_length=1000)
    participants: List[ParticipantCreate] = Field(default_factory=list)


class ParticipantRead(BaseModel):
    id: int
    user_id: int
    team: str
    role: str
    result: str
    score: int
    rank: int
    kills: int
    assists: int
    deaths: int
    custom_stats: str
    points_earned: int
    is_disputed: bool


class MatchRead(BaseModel):
    id: int
    venue_id: int
    listing_id: int
    match_type: str
    game_mode: str
    status: str
    played_at: str
    duration_minutes: int
    notes: str
    verified_at: str
    participants: List[ParticipantRead]


# ── Score adjustment ──────────────────────────────────────────────────────────

class ScoreAdjustmentCreate(BaseModel):
    user_id: int
    delta_points: int
    reason: str = Field(default="", max_length=500)
    match_id: int = 0


class ScoreAdjustmentRead(BaseModel):
    id: int
    user_id: int
    delta_points: int
    reason: str
    match_id: int


# ── Tournament ────────────────────────────────────────────────────────────────

class TournamentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    venue_id: int = 0
    listing_id: int = 0
    description: str = Field(default="", max_length=3000)
    rules: str = Field(default="", max_length=3000)
    game: str = Field(default="", max_length=60)
    format: str = Field(default="knockout", max_length=30)
    mode: str = Field(default="solo", max_length=20)
    max_participants: int = Field(default=16, ge=2)
    min_participants: int = Field(default=0, ge=0)
    entry_fee_paise: int = Field(default=0, ge=0)
    prize_pool_paise: int = Field(default=0, ge=0)
    prize_description: str = Field(default="", max_length=1000)
    registration_open: bool = False
    registration_deadline: str = Field(default="", max_length=30)
    starts_at: str = Field(default="", max_length=30)
    ends_at: str = Field(default="", max_length=30)
    is_exclusive: bool = False
    is_featured: bool = False
    awards_leaderboard_points: bool = True
    banner_url: str = Field(default="", max_length=500)


class TournamentUpdate(BaseModel):
    """Partial update — every field optional; used with exclude_unset=True."""
    name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    venue_id: Optional[int] = None
    listing_id: Optional[int] = None
    description: Optional[str] = Field(default=None, max_length=3000)
    rules: Optional[str] = Field(default=None, max_length=3000)
    game: Optional[str] = Field(default=None, max_length=60)
    format: Optional[str] = Field(default=None, max_length=30)
    mode: Optional[str] = Field(default=None, max_length=20)
    max_participants: Optional[int] = Field(default=None, ge=2)
    min_participants: Optional[int] = Field(default=None, ge=0)
    entry_fee_paise: Optional[int] = Field(default=None, ge=0)
    prize_pool_paise: Optional[int] = Field(default=None, ge=0)
    prize_description: Optional[str] = Field(default=None, max_length=1000)
    registration_open: Optional[bool] = None
    registration_deadline: Optional[str] = Field(default=None, max_length=30)
    starts_at: Optional[str] = Field(default=None, max_length=30)
    ends_at: Optional[str] = Field(default=None, max_length=30)
    status: Optional[str] = Field(default=None, max_length=20)
    is_exclusive: Optional[bool] = None
    is_featured: Optional[bool] = None
    awards_leaderboard_points: Optional[bool] = None
    banner_url: Optional[str] = Field(default=None, max_length=500)


class StageCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    stage_order: int = Field(default=1, ge=1)
    venue_id: int = 0
    is_online: bool = False
    location_name: str = Field(default="", max_length=200)
    address: str = Field(default="", max_length=500)
    lat: str = Field(default="", max_length=20)
    lng: str = Field(default="", max_length=20)
    starts_at: str = Field(default="", max_length=30)
    ends_at: str = Field(default="", max_length=30)
    notes: str = Field(default="", max_length=2000)


class StageUpdate(BaseModel):
    """Partial stage update — used with exclude_unset=True."""
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    stage_order: Optional[int] = Field(default=None, ge=1)
    venue_id: Optional[int] = None
    is_online: Optional[bool] = None
    location_name: Optional[str] = Field(default=None, max_length=200)
    address: Optional[str] = Field(default=None, max_length=500)
    lat: Optional[str] = Field(default=None, max_length=20)
    lng: Optional[str] = Field(default=None, max_length=20)
    starts_at: Optional[str] = Field(default=None, max_length=30)
    ends_at: Optional[str] = Field(default=None, max_length=30)
    notes: Optional[str] = Field(default=None, max_length=2000)


class RosterEntry(BaseModel):
    user_id: int
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=1, max_length=20)


class TournamentRegisterPayload(BaseModel):
    team_id: int = 0
    contact_name: str = Field(default="", max_length=120)
    contact_phone: str = Field(default="", max_length=20)
    roster: List[RosterEntry] = Field(default_factory=list)


class GenerateBracketPayload(BaseModel):
    # round_number → stage_id; unmapped rounds fall back to proportional
    # distribution across the tournament's stages (in stage_order).
    round_stage_map: dict[int, int] = Field(default_factory=dict)


class WalkoverPayload(BaseModel):
    winner_side: str = Field(pattern="^[AB]$")
    reason: str = Field(default="", max_length=300)


class CheckInPayload(BaseModel):
    code: str = Field(default="", max_length=40)
    user_id: int = 0


class TournamentRead(BaseModel):
    id: int
    name: str
    slug: str
    description: str
    rules: str
    game: str
    format: str
    mode: str
    max_participants: int
    entry_fee_paise: int
    prize_pool_paise: int
    prize_description: str
    registration_open: bool
    registration_deadline: str
    starts_at: str
    ends_at: str
    status: str
    is_exclusive: bool
    is_featured: bool
    banner_url: str
    participant_count: int = 0


class TournamentResultCreate(BaseModel):
    tournament_id: int
    user_id: int = 0
    team_id: int = 0
    position: int = Field(ge=1)
    prize_won_paise: int = Field(default=0, ge=0)


# ── Team ──────────────────────────────────────────────────────────────────────

class TeamCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    tag: str = Field(default="", max_length=10)
    city: str = Field(default="", max_length=120)
    category_id: int = 0


class TeamRead(BaseModel):
    id: int
    name: str
    tag: str
    logo_url: str
    city: str
    is_active: bool
    member_count: int = 0


# ── Leaderboard ───────────────────────────────────────────────────────────────

class LeaderboardRow(BaseModel):
    rank: int
    user_id: int
    username: str
    name: str
    avatar_url: str
    total_points: int
    matches_played: int
    wins: int
    losses: int
    draws: int


# ── News ──────────────────────────────────────────────────────────────────────

class NewsCreate(BaseModel):
    title: str = Field(min_length=3, max_length=300)
    summary: str = Field(default="", max_length=500)
    body: str = Field(default="", max_length=500000)   # up to 500k chars for long articles
    cover_url: str = Field(default="", max_length=500)
    category: str = Field(default="general", max_length=40)
    tags: str = Field(default="", max_length=300)
    is_published: bool = False


class NewsRead(BaseModel):
    id: int
    title: str
    slug: str
    summary: str
    body: str
    cover_url: str
    category: str
    tags: str
    is_published: bool
    published_at: str
    view_count: int


# ── Review ────────────────────────────────────────────────────────────────────

class ReviewCreate(BaseModel):
    venue_id: int
    rating: int = Field(..., ge=1, le=5)
    comment: str = Field("", max_length=500)


class ReviewRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    venue_id: Optional[int]
    listing_id: Optional[int]
    user_id: int
    username: str
    rating: int
    comment: str
    is_verified_visit: bool
    created_at: datetime
