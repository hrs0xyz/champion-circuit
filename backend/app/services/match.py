"""
Match recording, scoring, leaderboard, tournament, team service.
"""
import json
import re
import secrets
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.match import (
    LeaderboardSnapshot, Match, MatchParticipant,
    NewsArticle, Notification, ScoreAdjustment,
    Team, TeamInvite, TeamMember, Tournament,
    TournamentAdmin, TournamentRegistration, TournamentResult,
    TournamentStage, TournamentWaitlistEntry,
)
from app.models.user import User
from app.models.venue import Venue
from app.schemas.match import (
    MatchCreate, NewsCreate, ScoreAdjustmentCreate,
    TeamCreate, TournamentCreate, TournamentRegisterPayload,
    TournamentResultCreate,
)


# ── Points formula ────────────────────────────────────────────────────────────

POINTS = {
    "win_casual": 3,
    "win_ranked": 10,
    "win_tournament": 20,
    "draw": 2,
    "loss": 1,
    "tournament_registration": 1,
    "placement_1": 50,
    "placement_2": 30,
    "placement_3": 15,
}

MULTIPLIERS = {
    "tournament": 1.5,
    "verified_venue": 1.2,
}

# Finish-position leaderboard points for knockout tournaments
# (position → points; 5 = quarter-final losers).
PLACEMENT_POINTS = {1: 100, 2: 60, 3: 35, 5: 20}


# ── Time helpers ──────────────────────────────────────────────────────────────

def _iso_now() -> str:
    # No microseconds: keeps the string within the VARCHAR(30) columns
    # (Postgres enforces the length; "…T12:30:28+00:00" is 25 chars).
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _deadline_passed(deadline: str) -> bool:
    """
    True if the ISO-8601 deadline string is in the past. Empty → never passes.
    Naive datetimes are assumed UTC; unparseable values fall back to
    lexicographic comparison (chronological for well-formed ISO strings).
    """
    if not deadline:
        return False
    try:
        dl = datetime.fromisoformat(deadline)
        if dl.tzinfo is None:
            dl = dl.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) > dl
    except ValueError:
        return _iso_now() > deadline


def calculate_points(result: str, match_type: str, is_verified_venue: bool = False) -> int:
    base = 0
    if result == "win":
        if match_type == "tournament":
            base = POINTS["win_tournament"]
        elif match_type == "ranked":
            base = POINTS["win_ranked"]
        else:
            base = POINTS["win_casual"]
    elif result == "draw":
        base = POINTS["draw"]
    elif result in ("loss", "dnf"):
        base = POINTS["loss"]

    multiplier = 1.0
    if match_type == "tournament":
        multiplier *= MULTIPLIERS["tournament"]
    if is_verified_venue:
        multiplier *= MULTIPLIERS["verified_venue"]

    return max(0, int(base * multiplier))


# ── Match ─────────────────────────────────────────────────────────────────────

def create_match(db: Session, payload: MatchCreate, created_by_user_id: int) -> Match:
    match = Match(
        listing_id=payload.listing_id or None,
        venue_id=payload.venue_id or None,
        booking_id=payload.booking_id or None,
        tournament_id=payload.tournament_id or None,
        match_type=payload.match_type,
        game_mode=payload.game_mode,
        played_at=payload.played_at,
        duration_minutes=payload.duration_minutes,
        notes=payload.notes,
        created_by_user_id=created_by_user_id,
        status="scheduled",
    )
    db.add(match)
    db.flush()

    for p in payload.participants:
        participant = MatchParticipant(
            match_id=match.id,
            user_id=p.user_id,
            team=p.team,
            role=p.role,
            result=p.result,
            score=p.score,
            rank=p.rank,
            kills=p.kills,
            assists=p.assists,
            deaths=p.deaths,
            custom_stats=p.custom_stats,
        )
        db.add(participant)

    db.commit()
    db.refresh(match)
    return match


def verify_match(db: Session, match_id: int, admin_user_id: int) -> Match:
    """Admin verifies a match — calculates and writes points."""
    match = db.get(Match, match_id)
    if not match:
        raise ValueError("Match not found")
    if match.status == "completed":
        raise ValueError("Match already verified")

    match.status = "completed"
    match.verified_by_admin_id = admin_user_id
    # _iso_now() has no microseconds — fits the VARCHAR(30) column on Postgres
    match.verified_at = _iso_now()

    # Compute and write points for each participant
    for p in match.participants:
        pts = calculate_points(p.result, match.match_type)
        p.points_earned = pts

    db.commit()
    db.refresh(match)

    # Send notifications
    for p in match.participants:
        _notify(db, p.user_id, "match_recorded",
                "Match verified",
                f"Your {match.match_type} match has been verified. You earned {p.points_earned} points.",
                f"/match/{match.id}")
    return match


def get_match(db: Session, match_id: int) -> Match | None:
    return db.query(Match).filter(Match.id == match_id).first()


def list_matches(db: Session, venue_id: int = 0, user_id: int = 0,
                 status: str = "", skip: int = 0, limit: int = 50) -> list[Match]:
    q = db.query(Match)
    if venue_id:
        q = q.filter(Match.venue_id == venue_id)
    if status:
        q = q.filter(Match.status == status)
    if user_id:
        q = q.join(MatchParticipant).filter(MatchParticipant.user_id == user_id)
    return q.order_by(Match.created_at.desc()).offset(skip).limit(limit).all()


def serialize_match(match: Match) -> dict:
    return {
        "id": match.id,
        "venue_id": match.venue_id,
        "listing_id": match.listing_id,
        "match_type": match.match_type,
        "game_mode": match.game_mode,
        "status": match.status,
        "played_at": match.played_at,
        "duration_minutes": match.duration_minutes,
        "notes": match.notes,
        "verified_at": match.verified_at,
        "participants": [
            {
                "id": p.id,
                "user_id": p.user_id,
                "team": p.team,
                "role": p.role,
                "result": p.result,
                "score": p.score,
                "rank": p.rank,
                "kills": p.kills,
                "assists": p.assists,
                "deaths": p.deaths,
                "custom_stats": p.custom_stats,
                "points_earned": p.points_earned,
                "is_disputed": p.is_disputed,
            }
            for p in match.participants
        ],
    }


# ── Score adjustments ─────────────────────────────────────────────────────────

def apply_score_adjustment(db: Session, payload: ScoreAdjustmentCreate, admin_id: int) -> ScoreAdjustment:
    adj = ScoreAdjustment(
        user_id=payload.user_id,
        match_id=payload.match_id or None,
        adjusted_by_admin_id=admin_id,
        delta_points=payload.delta_points,
        reason=payload.reason,
    )
    db.add(adj)
    db.commit()
    db.refresh(adj)
    _notify(db, payload.user_id, "score_adjusted",
            "Points adjusted",
            f"An admin {'added' if payload.delta_points >= 0 else 'removed'} "
            f"{abs(payload.delta_points)} points. Reason: {payload.reason}",
            "/leaderboard")
    return adj


# ── Leaderboard ───────────────────────────────────────────────────────────────

def compute_leaderboard(
    db: Session,
    scope_type: str = "global",
    scope_id: str = "",
    period_type: str = "all_time",
    period_key: str = "",
    limit: int = 100,
) -> list[dict]:
    """
    Compute leaderboard from match_participants + score_adjustments.
    period_type: all_time (default) | weekly (last 7 days) | monthly (last 30 days).
    Returns list of dicts sorted by total_points desc.
    """
    from collections import defaultdict
    from datetime import datetime, timedelta, timezone

    cutoff = None
    if period_type == "weekly":
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    elif period_type == "monthly":
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)

    # Gather points from verified matches
    q = (
        db.query(MatchParticipant, Match, User)
        .join(Match, MatchParticipant.match_id == Match.id)
        .join(User, MatchParticipant.user_id == User.id)
        .filter(Match.status == "completed")
    )
    if cutoff:
        # verified_at is an ISO-8601 string; lexicographic comparison is chronological
        q = q.filter(Match.verified_at >= cutoff.isoformat())
    if scope_type == "venue" and scope_id:
        q = q.filter(Match.venue_id == int(scope_id))
    elif scope_type == "city" and scope_id:
        q = q.filter(User.city.ilike(scope_id))

    rows = q.all()

    stats: dict[int, dict] = defaultdict(lambda: {
        "total_points": 0, "matches_played": 0, "wins": 0, "losses": 0, "draws": 0,
        "user": None,
    })

    for participant, _match, user in rows:
        s = stats[user.id]
        s["user"] = user
        s["total_points"] += participant.points_earned
        s["matches_played"] += 1
        if participant.result == "win":
            s["wins"] += 1
        elif participant.result in ("loss", "dnf"):
            s["losses"] += 1
        elif participant.result == "draw":
            s["draws"] += 1

    # Apply score adjustments
    adj_q = db.query(ScoreAdjustment)
    if cutoff:
        adj_q = adj_q.filter(ScoreAdjustment.created_at >= cutoff)
    for adj in adj_q.all():
        if adj.user_id in stats:
            stats[adj.user_id]["total_points"] += adj.delta_points
        else:
            user = db.get(User, adj.user_id)
            if user:
                stats[adj.user_id]["user"] = user
                stats[adj.user_id]["total_points"] += adj.delta_points

    # Sort
    sorted_stats = sorted(stats.items(), key=lambda x: x[1]["total_points"], reverse=True)[:limit]

    result = []
    for rank, (user_id, s) in enumerate(sorted_stats, 1):
        u = s["user"]
        if not u:
            continue
        result.append({
            "rank": rank,
            "user_id": u.id,
            "username": u.username,
            "name": u.name or u.username,
            "avatar_url": u.avatar_url,
            "total_points": max(0, s["total_points"]),
            "matches_played": s["matches_played"],
            "wins": s["wins"],
            "losses": s["losses"],
            "draws": s["draws"],
        })
    return result


def get_user_total_points(db: Session, user_id: int) -> int:
    rows = (
        db.query(MatchParticipant)
        .join(Match)
        .filter(MatchParticipant.user_id == user_id, Match.status == "completed")
        .all()
    )
    base = sum(p.points_earned for p in rows)
    adjustments = db.query(ScoreAdjustment).filter(ScoreAdjustment.user_id == user_id).all()
    adj_total = sum(a.delta_points for a in adjustments)
    return max(0, base + adj_total)


# ── Tournaments ───────────────────────────────────────────────────────────────

def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text[:80]


def _unique_tournament_slug(db: Session, base: str) -> str:
    slug = _slugify(base)
    candidate = slug
    n = 1
    while db.query(Tournament).filter(Tournament.slug == candidate).first():
        n += 1
        candidate = f"{slug}-{n}"
    return candidate


def create_tournament(db: Session, payload: TournamentCreate, created_by: int) -> Tournament:
    slug = _unique_tournament_slug(db, payload.name)
    data = payload.model_dump()
    # 0 means "none" in the API but would violate the FK on Postgres
    data["venue_id"] = data.get("venue_id") or None
    data["listing_id"] = data.get("listing_id") or None
    t = Tournament(slug=slug, created_by=created_by, **data)
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def get_tournament(db: Session, tournament_id: int) -> Tournament | None:
    return db.get(Tournament, tournament_id)


def get_tournament_by_slug(db: Session, slug: str) -> Tournament | None:
    return db.query(Tournament).filter(Tournament.slug == slug).first()


PUBLIC_TOURNAMENT_STATUSES = ("registration", "live", "completed")


def list_tournaments(
    db: Session, status: str = "", game: str = "",
    venue_id: int = 0, skip: int = 0, limit: int = 50,
    public_only: bool = False,
) -> list[Tournament]:
    q = db.query(Tournament)
    if public_only:
        q = q.filter(Tournament.status.in_(PUBLIC_TOURNAMENT_STATUSES))
    if status:
        q = q.filter(Tournament.status == status)
    if game:
        q = q.filter(Tournament.game == game)
    if venue_id:
        q = q.filter(Tournament.venue_id == venue_id)
    return q.order_by(Tournament.starts_at.desc()).offset(skip).limit(limit).all()


# ── Tournament registration ───────────────────────────────────────────────────

def _new_checkin_code(db: Session, tournament_id: int) -> str:
    """Short uppercase code, unique within the tournament (used for QR check-in)."""
    for _ in range(20):
        code = secrets.token_hex(4).upper()
        clash = db.query(TournamentRegistration).filter(
            TournamentRegistration.tournament_id == tournament_id,
            TournamentRegistration.checkin_code == code,
        ).first()
        if not clash:
            return code
    raise RuntimeError("Could not generate a unique check-in code")


def _registration_count(db: Session, tournament_id: int) -> int:
    return db.query(TournamentRegistration).filter(
        TournamentRegistration.tournament_id == tournament_id
    ).count()


def _roster_user_ids(reg_or_entry) -> set[int]:
    """User ids covered by a registration/waitlist row: the captain + roster."""
    ids = {reg_or_entry.user_id}
    try:
        for member in json.loads(reg_or_entry.roster_json or "[]"):
            uid = member.get("user_id")
            if uid:
                ids.add(int(uid))
    except (ValueError, TypeError, AttributeError):
        pass
    return ids


def _validate_registration_payload(
    db: Session, t: Tournament, user: User, payload: TournamentRegisterPayload,
) -> dict:
    """
    Shared validation for register + waitlist-join. Returns the normalized
    column values for the row. Raises ValueError with a user-facing message.
    """
    contact_name = (payload.contact_name or user.name or user.username or "").strip()[:120]
    contact_phone = (payload.contact_phone or user.phone or "").strip()[:20]
    if not contact_phone:
        raise ValueError("A contact phone number is required")

    team_id = None
    roster: list[dict] = []
    if t.mode in ("duo", "squad", "team"):
        if not payload.team_id:
            raise ValueError("This is a team tournament — select your team to register")
        team = db.get(Team, payload.team_id)
        if not team or not team.is_active:
            raise ValueError("Team not found")
        if team.leader_user_id != user.id:
            raise ValueError("Only the team captain can register the squad")
        already = db.query(TournamentRegistration).filter(
            TournamentRegistration.tournament_id == t.id,
            TournamentRegistration.team_id == team.id,
        ).first()
        if already:
            raise ValueError("This team is already registered")
        if not payload.roster:
            raise ValueError("Enter the name and phone number of every squad member")

        member_ids = {m.user_id for m in team.members}
        seen: set[int] = set()
        for entry in payload.roster:
            if entry.user_id not in member_ids:
                raise ValueError("Every roster player must be a member of the selected team")
            if entry.user_id in seen:
                raise ValueError("Duplicate player in the roster")
            if not entry.name.strip() or not entry.phone.strip():
                raise ValueError("Every squad member needs a name and phone number")
            seen.add(entry.user_id)

        # A player may only appear in one squad per tournament
        others = db.query(TournamentRegistration).filter(
            TournamentRegistration.tournament_id == t.id
        ).all()
        roster_ids = seen | {user.id}
        for other in others:
            overlap = roster_ids & _roster_user_ids(other)
            if overlap:
                raise ValueError(
                    "A player in this roster is already registered for this tournament with another entry"
                )

        team_id = team.id
        roster = [
            {"user_id": e.user_id, "name": e.name.strip()[:120], "phone": e.phone.strip()[:20]}
            for e in payload.roster
        ]

    return {
        "team_id": team_id,
        "contact_name": contact_name,
        "contact_phone": contact_phone,
        "roster_json": json.dumps(roster),
    }


def _send_registration_email(db: Session, t: Tournament, user: User) -> None:
    from app.services import email as email_service
    venue = db.get(Venue, t.venue_id) if t.venue_id else None
    email_service._send_async(
        email_service.send_tournament_registration_email,
        user.email,
        user.display_name or user.name or user.username,
        t.name,
        t.slug,
        _fmt_when(t.starts_at),
        venue.name if venue else "",
    )


def _fmt_when(iso: str) -> str:
    """Human-friendly rendering of an ISO-8601 string; raw value if unparseable."""
    if not iso:
        return ""
    try:
        dt = datetime.fromisoformat(iso)
        return dt.strftime("%a %d %b %Y, %I:%M %p")
    except ValueError:
        return iso


def register_for_tournament(
    db: Session, tournament_id: int, user_id: int, payload: TournamentRegisterPayload,
) -> TournamentRegistration:
    from sqlalchemy.exc import IntegrityError

    t = db.get(Tournament, tournament_id)
    if not t:
        raise ValueError("Tournament not found")
    if t.status != "registration" or not t.registration_open:
        raise ValueError("Registration is closed")
    if _deadline_passed(t.registration_deadline):
        raise ValueError("Registration deadline has passed")

    user = db.get(User, user_id)
    if not user:
        raise ValueError("User not found")

    values = _validate_registration_payload(db, t, user, payload)

    if _registration_count(db, tournament_id) >= t.max_participants:
        raise ValueError("Tournament is full")
    existing = db.query(TournamentRegistration).filter(
        TournamentRegistration.tournament_id == tournament_id,
        TournamentRegistration.user_id == user_id,
    ).first()
    if existing:
        raise ValueError("Already registered")

    reg = TournamentRegistration(
        tournament_id=tournament_id,
        user_id=user_id,
        payment_status="paid" if t.entry_fee_paise == 0 else "unpaid",
        checkin_code=_new_checkin_code(db, tournament_id),
        **values,
    )
    db.add(reg)
    try:
        db.commit()
    except IntegrityError:
        # The unique constraint closes the two-tab / double-tap race
        db.rollback()
        raise ValueError("Already registered")
    db.refresh(reg)

    _notify(db, user_id, "tournament_registration",
            f"Registered for {t.name}",
            f"You're in! {t.name} starts {_fmt_when(t.starts_at) or 'soon'}. Good luck!",
            f"/tournaments/{t.slug}")
    _send_registration_email(db, t, user)
    return reg


def withdraw_from_tournament(db: Session, tournament_id: int, user_id: int) -> None:
    t = db.get(Tournament, tournament_id)
    if not t:
        raise ValueError("Tournament not found")
    reg = db.query(TournamentRegistration).filter(
        TournamentRegistration.tournament_id == tournament_id,
        TournamentRegistration.user_id == user_id,
    ).first()
    if not reg:
        raise ValueError("You are not registered for this tournament")
    if t.status != "registration":
        raise ValueError("Withdrawal is closed — the tournament has started")
    if _deadline_passed(t.registration_deadline):
        raise ValueError("Withdrawal window has closed")

    db.delete(reg)
    db.commit()
    _notify(db, user_id, "tournament_registration",
            f"Withdrawn from {t.name}",
            "Your registration has been withdrawn and your spot has been freed.",
            f"/tournaments/{t.slug}")
    promote_tournament_waitlist(db, t)


# ── Tournament waitlist ───────────────────────────────────────────────────────

def join_tournament_waitlist(
    db: Session, tournament_id: int, user_id: int, payload: TournamentRegisterPayload,
) -> TournamentWaitlistEntry:
    t = db.get(Tournament, tournament_id)
    if not t:
        raise ValueError("Tournament not found")
    if t.status != "registration" or not t.registration_open:
        raise ValueError("Registration is closed")
    if _deadline_passed(t.registration_deadline):
        raise ValueError("Registration deadline has passed")
    if _registration_count(db, tournament_id) < t.max_participants:
        raise ValueError("Tournament is not full — register directly")
    registered = db.query(TournamentRegistration).filter(
        TournamentRegistration.tournament_id == tournament_id,
        TournamentRegistration.user_id == user_id,
    ).first()
    if registered:
        raise ValueError("Already registered")

    user = db.get(User, user_id)
    if not user:
        raise ValueError("User not found")
    values = _validate_registration_payload(db, t, user, payload)

    entry = db.query(TournamentWaitlistEntry).filter(
        TournamentWaitlistEntry.tournament_id == tournament_id,
        TournamentWaitlistEntry.user_id == user_id,
    ).first()
    if entry:
        if entry.status == "waiting":
            raise ValueError("Already on the waitlist")
        # Re-join: reuse the row (unique constraint), refresh the snapshot
        entry.status = "waiting"
        entry.promoted_at = ""
        for key, val in values.items():
            setattr(entry, key, val)
    else:
        entry = TournamentWaitlistEntry(
            tournament_id=tournament_id, user_id=user_id, **values,
        )
        db.add(entry)
    db.commit()
    db.refresh(entry)
    _notify(db, user_id, "tournament_registration",
            f"On the waitlist for {t.name}",
            "You'll be promoted automatically if a spot opens up before the deadline.",
            f"/tournaments/{t.slug}")
    return entry


def leave_tournament_waitlist(db: Session, tournament_id: int, user_id: int) -> None:
    entry = db.query(TournamentWaitlistEntry).filter(
        TournamentWaitlistEntry.tournament_id == tournament_id,
        TournamentWaitlistEntry.user_id == user_id,
        TournamentWaitlistEntry.status == "waiting",
    ).first()
    if not entry:
        raise ValueError("You are not on the waitlist")
    entry.status = "left"
    db.commit()


def promote_tournament_waitlist(db: Session, t: Tournament) -> list[TournamentRegistration]:
    """
    Fill free seats from the waitlist (oldest first). No-op unless registration
    is still open and the deadline hasn't passed. Safe to call after any
    withdrawal or capacity change.
    """
    from sqlalchemy.exc import IntegrityError

    promoted: list[TournamentRegistration] = []
    if t.status != "registration" or _deadline_passed(t.registration_deadline):
        return promoted

    while _registration_count(db, t.id) < t.max_participants:
        entry = (
            db.query(TournamentWaitlistEntry)
            .filter(
                TournamentWaitlistEntry.tournament_id == t.id,
                TournamentWaitlistEntry.status == "waiting",
            )
            .order_by(TournamentWaitlistEntry.created_at.asc(), TournamentWaitlistEntry.id.asc())
            .first()
        )
        if not entry:
            break

        already = db.query(TournamentRegistration).filter(
            TournamentRegistration.tournament_id == t.id,
            TournamentRegistration.user_id == entry.user_id,
        ).first()
        if already:
            # Registered through some other path meanwhile — drop from the queue
            entry.status = "left"
            db.commit()
            continue

        reg = TournamentRegistration(
            tournament_id=t.id,
            user_id=entry.user_id,
            team_id=entry.team_id,
            payment_status="paid" if t.entry_fee_paise == 0 else "unpaid",
            checkin_code=_new_checkin_code(db, t.id),
            contact_name=entry.contact_name,
            contact_phone=entry.contact_phone,
            roster_json=entry.roster_json,
        )
        db.add(reg)
        entry.status = "promoted"
        entry.promoted_at = _iso_now()
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            entry.status = "left"
            db.commit()
            continue
        db.refresh(reg)

        _notify(db, entry.user_id, "tournament_registration",
                f"A spot opened up — you're in {t.name}!",
                "You've been promoted from the waitlist. Your registration is confirmed.",
                f"/tournaments/{t.slug}")
        user = db.get(User, entry.user_id)
        if user:
            _send_registration_email(db, t, user)
        promoted.append(reg)

    return promoted


# ── Min-participants lazy auto-cancel (no background scheduler) ───────────────

def maybe_auto_cancel(db: Session, t: Tournament) -> bool:
    """
    Cancel an under-subscribed tournament once its deadline has passed.
    Called lazily from public detail / staff list / bracket generation.
    """
    if t.status != "registration" or t.min_participants <= 0:
        return False
    if not _deadline_passed(t.registration_deadline):
        return False
    paid = db.query(TournamentRegistration).filter(
        TournamentRegistration.tournament_id == t.id,
        TournamentRegistration.payment_status == "paid",
    ).count()
    if paid >= t.min_participants:
        return False

    t.status = "cancelled"
    t.registration_open = False
    db.commit()
    regs = db.query(TournamentRegistration).filter(
        TournamentRegistration.tournament_id == t.id
    ).all()
    for reg in regs:
        _notify(db, reg.user_id, "tournament_registration",
                f"{t.name} has been cancelled",
                f"The tournament didn't reach the minimum of {t.min_participants} participants "
                f"by the registration deadline.",
                f"/tournaments/{t.slug}")
    return True


def record_tournament_result(
    db: Session, payload: TournamentResultCreate, admin_id: int
) -> TournamentResult:
    placement_pts = {1: POINTS["placement_1"], 2: POINTS["placement_2"], 3: POINTS["placement_3"]}
    earned = placement_pts.get(payload.position, 0)
    result = TournamentResult(
        tournament_id=payload.tournament_id,
        user_id=payload.user_id or None,
        team_id=payload.team_id or None,
        position=payload.position,
        points_earned=earned,
        prize_won_paise=payload.prize_won_paise,
        recorded_by_admin=admin_id,
    )
    db.add(result)
    db.commit()
    db.refresh(result)
    if payload.user_id:
        t = db.get(Tournament, payload.tournament_id)
        _notify(db, payload.user_id, "tournament_result",
                f"Tournament result recorded",
                f"You finished #{payload.position} in {t.name if t else 'the tournament'}. "
                f"You earned {earned} points.",
                f"/tournaments/{t.slug}" if t else "/tournaments")
    return result


def _serialize_venue_brief(db: Session, venue_id: int | None) -> dict | None:
    if not venue_id:
        return None
    v = db.get(Venue, venue_id)
    if not v:
        return None
    return {
        "id": v.id,
        "name": v.name,
        "city": v.city,
        "address_line1": v.address_line1,
        "lat": v.lat,
        "lng": v.lng,
    }


def serialize_stage(db: Session, s: TournamentStage) -> dict:
    """Stage with its location resolved: venue → custom fields → online."""
    venue = _serialize_venue_brief(db, s.venue_id)
    if venue:
        location_name, address, lat, lng = venue["name"], venue["address_line1"], venue["lat"], venue["lng"]
    elif s.location_name or s.address:
        location_name, address, lat, lng = s.location_name, s.address, s.lat, s.lng
    else:
        location_name, address, lat, lng = ("Online" if s.is_online else ""), "", "", ""
    return {
        "id": s.id,
        "tournament_id": s.tournament_id,
        "name": s.name,
        "stage_order": s.stage_order,
        "venue_id": s.venue_id,
        "venue": venue,
        "is_online": s.is_online,
        "location_name": location_name,
        "address": address,
        "lat": lat,
        "lng": lng,
        "starts_at": s.starts_at,
        "ends_at": s.ends_at,
        "notes": s.notes,
    }


def serialize_tournament(t: Tournament, db: Session) -> dict:
    count = db.query(TournamentRegistration).filter(
        TournamentRegistration.tournament_id == t.id
    ).count()
    return {
        "id": t.id,
        "name": t.name,
        "slug": t.slug,
        "description": t.description,
        "rules": t.rules,
        "game": t.game,
        "format": t.format,
        "mode": t.mode,
        "max_participants": t.max_participants,
        "min_participants": t.min_participants,
        "entry_fee_paise": t.entry_fee_paise,
        "prize_pool_paise": t.prize_pool_paise,
        "prize_description": t.prize_description,
        "registration_open": t.registration_open,
        "registration_deadline": t.registration_deadline,
        "starts_at": t.starts_at,
        "ends_at": t.ends_at,
        "status": t.status,
        "is_exclusive": t.is_exclusive,
        "is_featured": t.is_featured,
        "awards_leaderboard_points": t.awards_leaderboard_points,
        "banner_url": t.banner_url,
        "participant_count": count,
        "venue_id": t.venue_id,
        "venue": _serialize_venue_brief(db, t.venue_id),
        "registration_effectively_open": (
            t.status == "registration"
            and t.registration_open
            and not _deadline_passed(t.registration_deadline)
            and count < t.max_participants
        ),
    }


def _qr_svg(data: str) -> str:
    """Inline SVG QR code (same pattern as the voucher service)."""
    import io

    import qrcode
    import qrcode.image.svg

    img = qrcode.make(data, image_factory=qrcode.image.svg.SvgPathImage, box_size=6, border=2)
    buf = io.BytesIO()
    img.save(buf)
    return buf.getvalue().decode("utf-8")


def _side_display_name(db: Session, match: Match, side: str) -> str:
    """Public name for one side of a bracket match: team name, else captain's name."""
    parts = [p for p in match.participants if p.team == side]
    if not parts:
        return ""
    captain = next((p for p in parts if p.role == "captain"), parts[0])
    reg = db.query(TournamentRegistration).filter(
        TournamentRegistration.tournament_id == match.tournament_id,
        TournamentRegistration.user_id == captain.user_id,
    ).first()
    if reg and reg.team_id:
        team = db.get(Team, reg.team_id)
        if team:
            return team.name
    u = db.get(User, captain.user_id)
    if not u:
        return ""
    return u.display_name or u.name or u.username


def _match_venue_name(db: Session, match: Match) -> str:
    if match.stage_id:
        stage = db.get(TournamentStage, match.stage_id)
        if stage:
            if stage.venue_id:
                v = db.get(Venue, stage.venue_id)
                if v:
                    return v.name
            if stage.location_name:
                return stage.location_name
            if stage.is_online:
                return "Online"
    if match.venue_id:
        v = db.get(Venue, match.venue_id)
        if v:
            return v.name
    return ""


def serialize_my_registration(db: Session, reg: TournamentRegistration) -> dict:
    """A user's own registration: check-in QR + their next fixture."""
    try:
        roster = json.loads(reg.roster_json or "[]")
    except ValueError:
        roster = []

    team_name = ""
    if reg.team_id:
        team = db.get(Team, reg.team_id)
        if team:
            team_name = team.name

    next_match = None
    total_rounds = (
        db.query(func.max(Match.round_number))
        .filter(Match.tournament_id == reg.tournament_id, Match.round_number > 0)
        .scalar()
        or 0
    )
    if total_rounds:
        m = (
            db.query(Match)
            .join(MatchParticipant, MatchParticipant.match_id == Match.id)
            .filter(
                Match.tournament_id == reg.tournament_id,
                Match.round_number > 0,
                Match.status.in_(("scheduled", "live")),
                MatchParticipant.user_id == reg.user_id,
            )
            .order_by(Match.round_number.asc(), Match.bracket_position.asc())
            .first()
        )
        if m:
            my_side = next(
                (p.team for p in m.participants if p.user_id == reg.user_id), ""
            )
            opponent_side = "B" if my_side == "A" else "A"
            next_match = {
                "id": m.id,
                "round_number": m.round_number,
                "round_of": 2 ** (total_rounds - m.round_number + 1),
                "total_rounds": total_rounds,
                "status": m.status,
                "scheduled_at": m.scheduled_at,
                "opponent_name": _side_display_name(db, m, opponent_side) or "TBD",
                "venue_name": _match_venue_name(db, m),
            }

    return {
        "id": reg.id,
        "tournament_id": reg.tournament_id,
        "user_id": reg.user_id,
        "team_id": reg.team_id,
        "team_name": team_name,
        "payment_status": reg.payment_status,
        "seed_number": reg.seed_number,
        "checked_in_at": reg.checked_in_at,
        "checkin_code": reg.checkin_code,
        "contact_name": reg.contact_name,
        "contact_phone": reg.contact_phone,
        "roster": roster,
        "registered_at": reg.registered_at,
        "qr_svg": _qr_svg(f"CCT|{reg.tournament_id}|{reg.checkin_code}") if reg.checkin_code else "",
        "next_match": next_match,
    }


def serialize_tournament_detail(t: Tournament, db: Session) -> dict:
    """Everything the public detail page needs: stages, participants, podium."""
    data = serialize_tournament(t, db)

    data["stages"] = [serialize_stage(db, s) for s in t.stages]

    participants = []
    regs = (
        db.query(TournamentRegistration)
        .filter(TournamentRegistration.tournament_id == t.id)
        .order_by(TournamentRegistration.registered_at.asc())
        .all()
    )
    for reg in regs:
        u = db.get(User, reg.user_id)
        if not u:
            continue
        team_name = ""
        if reg.team_id:
            team = db.get(Team, reg.team_id)
            if team:
                team_name = team.name
        participants.append({
            "user_id": u.id,
            "username": u.username,
            "name": u.display_name or u.name or u.username,
            "avatar_url": u.avatar_url,
            "team_name": team_name,
            "seed_number": reg.seed_number,
            "checked_in": bool(reg.checked_in_at),
        })
    data["participants"] = participants

    results = []
    for res in sorted(t.results, key=lambda r: r.position):
        u = db.get(User, res.user_id) if res.user_id else None
        team = db.get(Team, res.team_id) if res.team_id else None
        results.append({
            "position": res.position,
            "user_id": res.user_id,
            "username": u.username if u else "",
            "name": (u.display_name or u.name or u.username) if u else "",
            "team_name": team.name if team else "",
            "points_earned": res.points_earned,
            "prize_won_paise": res.prize_won_paise,
        })
    data["results"] = results

    return data


# ── Teams ─────────────────────────────────────────────────────────────────────

def create_team(db: Session, payload: TeamCreate, leader_user_id: int) -> Team:
    team = Team(
        name=payload.name,
        tag=payload.tag,
        city=payload.city,
        category_id=payload.category_id or None,
        leader_user_id=leader_user_id,
    )
    db.add(team)
    db.flush()
    member = TeamMember(team_id=team.id, user_id=leader_user_id, role="leader")
    db.add(member)
    db.commit()
    db.refresh(team)
    return team


def invite_to_team(db: Session, team_id: int, invited_email: str) -> TeamInvite:
    from app.services.users import get_user_by_email
    user = get_user_by_email(db, invited_email)
    invite = TeamInvite(
        team_id=team_id,
        invited_email=invited_email.lower(),
        invited_user_id=user.id if user else None,
        status="pending",
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    if user:
        _notify(db, user.id, "team_invite",
                "Team invitation",
                f"You've been invited to join a team.",
                "/profile")
    return invite


def get_user_teams(db: Session, user_id: int) -> list[Team]:
    return (
        db.query(Team)
        .join(TeamMember, Team.id == TeamMember.team_id)
        .filter(TeamMember.user_id == user_id, Team.is_active == True)  # noqa: E712
        .all()
    )


# ── Notifications ─────────────────────────────────────────────────────────────

def _notify(db: Session, user_id: int, ntype: str, title: str, body: str, link: str = "") -> None:
    notif = Notification(
        user_id=user_id,
        type=ntype,
        title=title,
        body=body,
        link=link,
    )
    db.add(notif)
    # Commit here: every caller invokes _notify after its own final commit, and
    # the request-scoped session closes without committing — without this the
    # notification row is silently discarded.
    db.commit()


def get_notifications(db: Session, user_id: int, unread_only: bool = False) -> list[Notification]:
    q = db.query(Notification).filter(Notification.user_id == user_id)
    if unread_only:
        q = q.filter(Notification.is_read == False)  # noqa: E712
    return q.order_by(Notification.created_at.desc()).limit(50).all()


def mark_notifications_read(db: Session, user_id: int) -> None:
    db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == False,  # noqa: E712
    ).update({"is_read": True})
    db.commit()


# ── News ──────────────────────────────────────────────────────────────────────

def _unique_news_slug(db: Session, base: str) -> str:
    slug = _slugify(base)
    candidate = slug
    n = 1
    while db.query(NewsArticle).filter(NewsArticle.slug == candidate).first():
        n += 1
        candidate = f"{slug}-{n}"
    return candidate


def create_news(db: Session, payload: NewsCreate, author_id: int) -> NewsArticle:
    from datetime import datetime, timezone
    slug = _unique_news_slug(db, payload.title)
    published_at = ""
    if payload.is_published:
        published_at = datetime.now(timezone.utc).isoformat()
    article = NewsArticle(
        slug=slug,
        author_user_id=author_id,
        published_at=published_at,
        **payload.model_dump(),
    )
    db.add(article)
    db.commit()
    db.refresh(article)
    return article


def publish_news(db: Session, article_id: int) -> NewsArticle:
    from datetime import datetime, timezone
    article = db.get(NewsArticle, article_id)
    if not article:
        raise ValueError("Article not found")
    article.is_published = True
    article.published_at = datetime.now(timezone.utc).isoformat()
    db.commit()
    db.refresh(article)
    return article


def list_news(
    db: Session, category: str = "", published_only: bool = True,
    skip: int = 0, limit: int = 20
) -> list[NewsArticle]:
    q = db.query(NewsArticle)
    if published_only:
        q = q.filter(NewsArticle.is_published == True)  # noqa: E712
    if category:
        q = q.filter(NewsArticle.category == category)
    return q.order_by(NewsArticle.created_at.desc()).offset(skip).limit(limit).all()


def get_news(db: Session, article_id: int) -> NewsArticle | None:
    return db.get(NewsArticle, article_id)


def serialize_news(article: NewsArticle) -> dict:
    return {
        "id": article.id,
        "title": article.title,
        "slug": article.slug,
        "summary": article.summary,
        "body": article.body,
        "cover_url": article.cover_url,
        "category": article.category,
        "tags": article.tags,
        "is_published": article.is_published,
        "published_at": article.published_at,
        "view_count": article.view_count,
    }
