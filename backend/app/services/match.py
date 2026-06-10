"""
Match recording, scoring, leaderboard, tournament, team service.
"""
import re
from sqlalchemy.orm import Session

from app.models.match import (
    LeaderboardSnapshot, Match, MatchParticipant,
    NewsArticle, Notification, ScoreAdjustment,
    Team, TeamInvite, TeamMember, Tournament,
    TournamentRegistration, TournamentResult,
)
from app.models.user import User
from app.schemas.match import (
    MatchCreate, NewsCreate, ScoreAdjustmentCreate,
    TeamCreate, TournamentCreate, TournamentResultCreate,
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
    from datetime import datetime, timezone
    match = db.get(Match, match_id)
    if not match:
        raise ValueError("Match not found")
    if match.status == "completed":
        raise ValueError("Match already verified")

    match.status = "completed"
    match.verified_by_admin_id = admin_user_id
    match.verified_at = datetime.now(timezone.utc).isoformat()

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
    Returns list of dicts sorted by total_points desc.
    """
    from collections import defaultdict

    # Gather points from verified matches
    q = (
        db.query(MatchParticipant, Match, User)
        .join(Match, MatchParticipant.match_id == Match.id)
        .join(User, MatchParticipant.user_id == User.id)
        .filter(Match.status == "completed")
    )
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
    t = Tournament(slug=slug, created_by=created_by, **payload.model_dump())
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def get_tournament(db: Session, tournament_id: int) -> Tournament | None:
    return db.get(Tournament, tournament_id)


def list_tournaments(
    db: Session, status: str = "", game: str = "",
    venue_id: int = 0, skip: int = 0, limit: int = 50
) -> list[Tournament]:
    q = db.query(Tournament)
    if status:
        q = q.filter(Tournament.status == status)
    if game:
        q = q.filter(Tournament.game == game)
    if venue_id:
        q = q.filter(Tournament.venue_id == venue_id)
    return q.order_by(Tournament.starts_at.desc()).offset(skip).limit(limit).all()


def register_for_tournament(db: Session, tournament_id: int, user_id: int, team_id: int = 0) -> TournamentRegistration:
    t = db.get(Tournament, tournament_id)
    if not t:
        raise ValueError("Tournament not found")
    if not t.registration_open:
        raise ValueError("Registration is closed")
    count = db.query(TournamentRegistration).filter(
        TournamentRegistration.tournament_id == tournament_id
    ).count()
    if count >= t.max_participants:
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
        team_id=team_id or None,
        payment_status="paid" if t.entry_fee_paise == 0 else "unpaid",
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)
    _notify(db, user_id, "tournament_result",
            f"Registered for {t.name}",
            f"You've registered for {t.name}. Good luck!",
            f"/esports/tournament/{tournament_id}")
    return reg


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
                f"/esports/tournament/{payload.tournament_id}")
    return result


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
        "banner_url": t.banner_url,
        "participant_count": count,
    }


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
    # Don't commit here — caller commits


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
