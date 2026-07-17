"""
Match, tournament, team, leaderboard, news routes.

Matches:
  POST /api/matches               create match (venue staff)
  GET  /api/matches/{id}          match detail
  GET  /api/matches               list matches
  POST /api/matches/{id}/verify   admin verifies match → awards points
  GET  /api/matches/me            my match history

Score:
  POST /api/scores/adjust         admin adjusts user points
  GET  /api/scores/user/{user_id} user's total points

Leaderboard:
  GET  /api/leaderboard           computed leaderboard

Tournaments:
  GET  /api/tournaments           list tournaments
  POST /api/tournaments           create (admin)
  GET  /api/tournaments/{id}      detail
  PUT  /api/tournaments/{id}      update (admin)
  POST /api/tournaments/{id}/register  register
  POST /api/tournaments/{id}/results   record results (admin)

Teams:
  POST /api/teams                 create team
  GET  /api/teams/me              my teams
  POST /api/teams/{id}/invite     invite member

News:
  GET  /api/news                  list published articles
  GET  /api/news/{id}             article detail
  POST /api/news                  create (admin)
  PUT  /api/news/{id}             update (admin)
  POST /api/news/{id}/publish     publish (admin)

Notifications:
  GET  /api/notifications         my notifications
  POST /api/notifications/read    mark all read
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_user, get_optional_user, is_tournament_admin,
    require_tournament_manage_access,
)
from app.db.session import get_db
from app.models.match import Tournament, TournamentRegistration
from app.models.user import User
from app.schemas.match import (
    MatchCreate, NewsCreate, ScoreAdjustmentCreate,
    TeamCreate, TournamentCreate, TournamentRegisterPayload,
    TournamentResultCreate, TournamentUpdate,
)
from app.services.match import (
    apply_score_adjustment,
    compute_leaderboard,
    create_match,
    create_news,
    create_team,
    create_tournament,
    get_match,
    get_news,
    get_notifications,
    get_tournament,
    get_tournament_by_slug,
    get_user_teams,
    get_user_total_points,
    invite_to_team,
    join_tournament_waitlist,
    leave_tournament_waitlist,
    list_matches,
    list_news,
    list_tournaments,
    mark_notifications_read,
    maybe_auto_cancel,
    promote_tournament_waitlist,
    publish_news,
    record_tournament_result,
    register_for_tournament,
    serialize_bracket,
    serialize_match,
    serialize_my_registration,
    serialize_news,
    serialize_tournament,
    serialize_tournament_detail,
    verify_match,
    withdraw_from_tournament,
)
from app.services.venue import is_venue_staff

router = APIRouter()


def _require_admin(user: User) -> None:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")


# ── Matches ───────────────────────────────────────────────────────────────────

@router.post("/matches", status_code=status.HTTP_201_CREATED)
def create_match_route(
    payload: MatchCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    allowed = (
        current_user.is_admin
        or is_venue_staff(db, payload.venue_id, current_user.id)
        # Match admins record side matches for their assigned tournament —
        # the staff portal submits these with venue_id 0
        or (payload.tournament_id and is_tournament_admin(db, current_user, payload.tournament_id))
    )
    if not allowed:
        raise HTTPException(status_code=403, detail="Only venue staff can record matches")
    match = create_match(db, payload, current_user.id)
    return serialize_match(match)


@router.get("/matches/me")
def my_matches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    matches = list_matches(db, user_id=current_user.id)
    return [serialize_match(m) for m in matches]


@router.get("/matches")
def list_matches_route(
    venue_id: int = 0,
    status_filter: str = "",
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    matches = list_matches(db, venue_id=venue_id, status=status_filter, skip=skip, limit=limit)
    return [serialize_match(m) for m in matches]


@router.get("/matches/{match_id}")
def match_detail(
    match_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    match = get_match(db, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    return serialize_match(match)


@router.post("/matches/{match_id}/verify")
def verify_match_route(
    match_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    try:
        match = verify_match(db, match_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return serialize_match(match)


# ── Score adjustments ─────────────────────────────────────────────────────────

@router.post("/scores/adjust")
def adjust_score(
    payload: ScoreAdjustmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    adj = apply_score_adjustment(db, payload, current_user.id)
    return {"id": adj.id, "user_id": adj.user_id, "delta_points": adj.delta_points, "reason": adj.reason}


@router.get("/scores/user/{user_id}")
def user_score(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    total = get_user_total_points(db, user_id)
    return {"user_id": user_id, "total_points": total}


# ── Leaderboard ───────────────────────────────────────────────────────────────

@router.get("/leaderboard")
def leaderboard(
    scope_type: str = "global",
    scope_id: str = "",
    period_type: str = "all_time",
    limit: int = 100,
    db: Session = Depends(get_db),
):
    rows = compute_leaderboard(
        db,
        scope_type=scope_type,
        scope_id=scope_id,
        period_type=period_type,
        limit=min(limit, 200),
    )
    return rows


# ── Tournaments ───────────────────────────────────────────────────────────────
#
# NOTE: static paths (my-registrations, by-slug/…) MUST be declared before the
# dynamic /tournaments/{tournament_id} routes — FastAPI matches in declaration
# order, and "my-registrations" would otherwise 422 as a non-int tournament_id.

@router.get("/tournaments")
def list_tournaments_route(
    status_filter: str = "",
    game: str = "",
    venue_id: int = 0,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """Public list — drafts and pending-approval tournaments are hidden."""
    tournaments = list_tournaments(
        db, status=status_filter, game=game, venue_id=venue_id,
        skip=skip, limit=limit, public_only=True,
    )
    return [serialize_tournament(t, db) for t in tournaments]


@router.post("/tournaments", status_code=status.HTTP_201_CREATED)
def create_tournament_route(
    payload: TournamentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    if payload.entry_fee_paise:
        # No payment flow exists yet — a paid tournament could never confirm
        # a registration (generate_bracket only counts payment_status='paid')
        raise HTTPException(
            status_code=400,
            detail="Paid entry is not supported yet — keep the entry fee at 0 (free)",
        )
    t = create_tournament(db, payload, current_user.id)
    return serialize_tournament(t, db)


@router.get("/tournaments/my-registrations")
def my_tournament_registrations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    regs = (
        db.query(TournamentRegistration)
        .filter(TournamentRegistration.user_id == current_user.id)
        .order_by(TournamentRegistration.registered_at.desc())
        .all()
    )
    out = []
    for reg in regs:
        t = db.get(Tournament, reg.tournament_id)
        if not t:
            continue
        out.append({
            "tournament": serialize_tournament(t, db),
            "registration": serialize_my_registration(db, reg),
        })
    return out


@router.get("/tournaments/by-slug/{slug}")
def tournament_detail_by_slug(
    slug: str,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Public detail page. Embeds my_registration/my_waitlist when authenticated."""
    t = get_tournament_by_slug(db, slug)
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")

    # Drafts/pending are only visible to admins and the creator
    if t.status in ("draft", "pending_approval"):
        can_preview = current_user and (current_user.is_admin or t.created_by == current_user.id)
        if not can_preview:
            raise HTTPException(status_code=404, detail="Tournament not found")

    # Lazy deadline enforcement (no background scheduler)
    maybe_auto_cancel(db, t)

    data = serialize_tournament_detail(t, db)
    data["my_registration"] = None
    data["on_waitlist"] = False
    if current_user:
        reg = db.query(TournamentRegistration).filter(
            TournamentRegistration.tournament_id == t.id,
            TournamentRegistration.user_id == current_user.id,
        ).first()
        if reg:
            data["my_registration"] = serialize_my_registration(db, reg)
        else:
            from app.models.match import TournamentWaitlistEntry
            entry = db.query(TournamentWaitlistEntry).filter(
                TournamentWaitlistEntry.tournament_id == t.id,
                TournamentWaitlistEntry.user_id == current_user.id,
                TournamentWaitlistEntry.status == "waiting",
            ).first()
            data["on_waitlist"] = entry is not None
    return data


@router.get("/tournaments/{tournament_id}")
def tournament_detail(
    tournament_id: int,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    t = get_tournament(db, tournament_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    # Same visibility rule as by-slug: drafts/pending are not public
    if t.status in ("draft", "pending_approval"):
        can_preview = current_user and (current_user.is_admin or t.created_by == current_user.id)
        if not can_preview:
            raise HTTPException(status_code=404, detail="Tournament not found")
    return serialize_tournament(t, db)


@router.get("/tournaments/{tournament_id}/bracket")
def tournament_bracket(tournament_id: int, db: Session = Depends(get_db)):
    t = get_tournament(db, tournament_id)
    if not t or t.status in ("draft", "pending_approval"):
        raise HTTPException(status_code=404, detail="Tournament not found")
    bracket = serialize_bracket(t, db)
    if not bracket["stages"]:
        raise HTTPException(status_code=404, detail="Bracket not generated yet")
    return bracket


@router.put("/tournaments/{tournament_id}")
def update_tournament(
    tournament_id: int,
    payload: TournamentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = require_tournament_manage_access(db, current_user, tournament_id)
    data = payload.model_dump(exclude_unset=True)
    if data.get("entry_fee_paise"):
        # Free entry at launch — the payment flow (Razorpay order/confirm)
        # is not wired yet, and a paid tournament would be unrunnable.
        raise HTTPException(
            status_code=400,
            detail="Paid entry is not supported yet — keep the entry fee at 0 (free)",
        )
    if not current_user.is_admin:
        # Venue owners: drafts only. Once submitted for approval the content
        # is frozen — otherwise it could be swapped between review and approve.
        if t.status != "draft":
            raise HTTPException(
                status_code=403,
                detail="Only draft tournaments can be edited — "
                       "ask the platform admin to send it back to draft first",
            )
        for locked in ("status", "is_featured", "venue_id", "listing_id", "registration_open"):
            data.pop(locked, None)
    if "venue_id" in data:
        data["venue_id"] = data["venue_id"] or None
    if "listing_id" in data:
        data["listing_id"] = data["listing_id"] or None
    seats_may_have_freed = (
        data.get("max_participants", 0) > t.max_participants
        or data.get("registration_open") is True
    )
    for key, val in data.items():
        setattr(t, key, val)
    db.commit()
    db.refresh(t)
    if seats_may_have_freed:
        # Freed seats go to the waitlist (oldest first) before new walk-ins;
        # the promoter is internally guarded on status + deadline.
        promote_tournament_waitlist(db, t)
    return serialize_tournament(t, db)


@router.post("/tournaments/{tournament_id}/register")
def register_tournament(
    tournament_id: int,
    payload: TournamentRegisterPayload | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        reg = register_for_tournament(
            db, tournament_id, current_user.id, payload or TournamentRegisterPayload(),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"id": reg.id, "message": "Registered successfully"}


@router.delete("/tournaments/{tournament_id}/register")
def withdraw_tournament(
    tournament_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        withdraw_from_tournament(db, tournament_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": "Withdrawn — your spot has been freed"}


@router.post("/tournaments/{tournament_id}/waitlist")
def join_waitlist(
    tournament_id: int,
    payload: TournamentRegisterPayload | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        entry = join_tournament_waitlist(
            db, tournament_id, current_user.id, payload or TournamentRegisterPayload(),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"id": entry.id, "message": "Added to the waitlist"}


@router.delete("/tournaments/{tournament_id}/waitlist")
def leave_waitlist(
    tournament_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        leave_tournament_waitlist(db, tournament_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": "Removed from the waitlist"}


@router.post("/tournaments/{tournament_id}/results")
def tournament_results(
    tournament_id: int,
    results: list[TournamentResultCreate],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    recorded = []
    for r in results:
        r.tournament_id = tournament_id
        res = record_tournament_result(db, r, current_user.id)
        recorded.append({"position": res.position, "user_id": res.user_id, "points_earned": res.points_earned})
    # Mark tournament completed
    t = get_tournament(db, tournament_id)
    if t:
        t.status = "completed"
        db.commit()
    return recorded


# ── Teams ─────────────────────────────────────────────────────────────────────

@router.post("/teams", status_code=status.HTTP_201_CREATED)
def create_team_route(
    payload: TeamCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team = create_team(db, payload, current_user.id)
    return {"id": team.id, "name": team.name, "tag": team.tag}


@router.get("/teams/me")
def my_teams(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teams = get_user_teams(db, current_user.id)
    out = []
    for t in teams:
        members = []
        for m in t.members:
            u = db.get(User, m.user_id)
            if u:
                members.append({
                    "user_id": u.id,
                    "username": u.username,
                    "name": u.display_name or u.name or u.username,
                    "phone": u.phone,
                    "role": m.role,
                })
        out.append({
            "id": t.id, "name": t.name, "tag": t.tag,
            "city": t.city, "logo_url": t.logo_url,
            "leader_user_id": t.leader_user_id,
            "member_count": len(t.members),
            "members": members,
        })
    return out


@router.post("/teams/{team_id}/invite")
def team_invite(
    team_id: int,
    email: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.match import Team
    team = db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if team.leader_user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only team leader can invite")
    invite = invite_to_team(db, team_id, email)
    return {"id": invite.id, "email": invite.invited_email, "status": invite.status}


# ── News ──────────────────────────────────────────────────────────────────────

@router.get("/news")
def list_news_route(
    category: str = "",
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    articles = list_news(db, category=category, published_only=True, skip=skip, limit=min(limit, 50))
    return [serialize_news(a) for a in articles]


@router.get("/admin/news")
def admin_list_news(
    category: str = "",
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin-only: returns all articles including drafts."""
    _require_admin(current_user)
    articles = list_news(db, category=category, published_only=False, skip=skip, limit=min(limit, 100))
    return [serialize_news(a) for a in articles]


@router.get("/news/{article_id}")
def news_detail(article_id: int, db: Session = Depends(get_db)):
    article = get_news(db, article_id)
    if not article or not article.is_published:
        raise HTTPException(status_code=404, detail="Article not found")
    article.view_count += 1
    db.commit()
    return serialize_news(article)


@router.post("/news", status_code=status.HTTP_201_CREATED)
def create_news_route(
    payload: NewsCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    article = create_news(db, payload, current_user.id)
    return serialize_news(article)


@router.put("/news/{article_id}")
def update_news(
    article_id: int,
    payload: NewsCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    article = get_news(db, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    for key, val in payload.model_dump(exclude_unset=True).items():
        setattr(article, key, val)
    db.commit()
    db.refresh(article)
    return serialize_news(article)


@router.post("/news/{article_id}/publish")
def publish_news_route(
    article_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    try:
        article = publish_news(db, article_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return serialize_news(article)


@router.delete("/news/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_news(
    article_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    from app.models.match import NewsArticle
    article = db.get(NewsArticle, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    db.delete(article)
    db.commit()


# ── Notifications ─────────────────────────────────────────────────────────────

@router.get("/notifications")
def my_notifications(
    unread_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notifs = get_notifications(db, current_user.id, unread_only=unread_only)
    return [
        {
            "id": n.id, "type": n.type, "title": n.title,
            "body": n.body, "link": n.link,
            "is_read": n.is_read, "created_at": n.created_at,
        }
        for n in notifs
    ]


@router.post("/notifications/read")
def read_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    mark_notifications_read(db, current_user.id)
    return {"message": "All notifications marked as read"}
