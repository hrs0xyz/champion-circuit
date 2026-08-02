"""
Staff portal routes — only accessible via /staff-login page.

Super Admin (is_admin=True):
  GET  /api/admin/users                    list all users
  GET  /api/admin/users/{id}               user detail
  PUT  /api/admin/users/{id}               edit any user (role, ban, etc)
  PUT  /api/admin/users/{id}/password      reset any user's password
  POST /api/admin/users/{id}/make-admin    promote to admin
  POST /api/admin/users/{id}/make-venue-owner
  POST /api/admin/users                    create staff account

  GET  /api/admin/venues                   all venues
  PUT  /api/admin/venues/{id}/verify       verify a venue
  PUT  /api/admin/venues/{id}/suspend      suspend a venue

  POST /api/admin/tournaments/{id}/assign-match-admin   assign match admin
  GET  /api/admin/tournaments/{id}/admins               list match admins

  GET  /api/admin/stats                    dashboard stats

Turf Owner (is_venue_owner=True):
  GET  /api/staff/my-venue                 own venue info
  GET  /api/staff/my-listings              listings for their venue
  GET  /api/staff/my-bookings              bookings for their venue
  GET  /api/staff/my-tournaments           tournaments at their venue
  POST /api/staff/tournaments/{id}/assign-match-admin

Match Admin (assigned to tournament):
  GET  /api/staff/tournaments/{id}/matches       matches for tournament
  POST /api/staff/tournaments/{id}/matches       record a match
  PUT  /api/staff/matches/{id}                   edit match scores
  POST /api/staff/matches/{id}/verify            verify match
  GET  /api/staff/tournaments/{id}/participants  list registrations
"""

from app.core.security import hash_password
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, is_tournament_admin, require_tournament_manage_access
from app.db.session import get_db
from app.models.match import (
    Match, MatchParticipant, Team, Tournament, TournamentAdmin,
    TournamentRegistration, TournamentStage,
)
from app.models.user import User
from app.models.venue import Venue
from app.schemas.match import (
    CheckInPayload, GenerateBracketPayload, StageCreate, StageUpdate,
    TournamentCreate, WalkoverPayload,
)
from app.services.match import (
    approve_tournament,
    block_stage_slots,
    cancel_tournament,
    check_in_registration,
    create_match,
    create_tournament,
    generate_bracket,
    list_tournaments,
    maybe_auto_cancel,
    registrations_csv,
    reject_tournament,
    remind_checkin,
    serialize_bracket,
    serialize_match,
    serialize_stage,
    serialize_tournament,
    submit_tournament_for_approval,
    verify_match,
    walkover_match,
)
from app.services.venue import get_user_venue, serialize_venue

router = APIRouter()


def _require_admin(user: User) -> None:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Super admin access required")


def _require_venue_staff(user: User) -> None:
    if not user.is_venue_owner and not user.is_admin:
        raise HTTPException(status_code=403, detail="Venue owner access required")


# ── Super Admin — Users ───────────────────────────────────────────────────────

@router.get("/admin/stats")
def admin_stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_admin(current_user)
    return {
        "total_users": db.query(User).count(),
        "total_venues": db.query(Venue).count(),
        "total_tournaments": db.query(Tournament).count(),
        "total_matches": db.query(Match).count(),
        "pending_matches": db.query(Match).filter(Match.status == "scheduled").count(),
    }


@router.get("/admin/users")
def list_all_users(
    skip: int = 0, limit: int = 50, search: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    q = db.query(User)
    if search:
        q = q.filter(
            User.username.ilike(f"%{search}%") |
            User.email.ilike(f"%{search}%") |
            User.name.ilike(f"%{search}%")
        )
    users = q.order_by(User.created_at.desc()).offset(skip).limit(min(limit, 200)).all()
    return [_user_summary(u) for u in users]


@router.get("/admin/users/{user_id}")
def get_user_detail(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_summary(u)


@router.put("/admin/users/{user_id}")
def edit_user(
    user_id: int,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    allowed = {"name", "city", "is_active", "is_admin", "is_venue_owner", "bio"}
    for k, v in payload.items():
        if k in allowed:
            setattr(u, k, v)
    db.commit()
    return _user_summary(u)


@router.put("/admin/users/{user_id}/password")
def reset_user_password(
    user_id: int,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    new_pw = payload.get("new_password", "")
    if len(new_pw) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    u.hashed_password = hash_password(new_pw)
    db.commit()
    return {"message": f"Password updated for @{u.username}"}


@router.post("/admin/users", status_code=status.HTTP_201_CREATED)
def create_staff_account(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a turf owner or match admin account."""
    _require_admin(current_user)
    from app.services.users import get_user_by_username, get_user_by_email
    if get_user_by_username(db, payload.get("username", "")):
        raise HTTPException(status_code=409, detail="Username already taken")
    if get_user_by_email(db, payload.get("email", "")):
        raise HTTPException(status_code=409, detail="Email already registered")
    u = User(
        username=payload["username"].lower().strip(),
        email=payload["email"].lower().strip(),
        hashed_password=hash_password(payload.get("password", "changeme123")),
        auth_provider="password",
        name=payload.get("name", payload["username"]),
        is_venue_owner=payload.get("is_venue_owner", False),
        is_admin=payload.get("is_admin", False),
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return _user_summary(u)


# ── Super Admin — Venues ──────────────────────────────────────────────────────

@router.get("/admin/venues")
def all_venues(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    venues = db.query(Venue).order_by(Venue.created_at.desc()).all()
    return [serialize_venue(v) for v in venues]


@router.post("/admin/venues/{venue_id}/verify")
def verify_venue(
    venue_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    v = db.get(Venue, venue_id)
    if not v:
        raise HTTPException(status_code=404, detail="Venue not found")
    v.is_verified = True
    db.commit()
    return {"message": f"Venue '{v.name}' verified"}


@router.post("/admin/venues/{venue_id}/suspend")
def suspend_venue(
    venue_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    v = db.get(Venue, venue_id)
    if not v:
        raise HTTPException(status_code=404, detail="Venue not found")
    v.is_active = not v.is_active
    db.commit()
    return {"message": f"Venue {'activated' if v.is_active else 'suspended'}"}


# ── Tournament admin assignment ───────────────────────────────────────────────

@router.post("/admin/tournaments/{tournament_id}/assign-match-admin")
def assign_match_admin(
    tournament_id: int,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Assign a user as match admin for a tournament. Super admin or venue owner can do this."""
    require_tournament_manage_access(db, current_user, tournament_id)

    username = payload.get("username", "")
    from app.services.users import get_user_by_username
    target = get_user_by_username(db, username)
    if not target:
        raise HTTPException(status_code=404, detail=f"User @{username} not found")

    # Check if already assigned
    existing = db.query(TournamentAdmin).filter(
        TournamentAdmin.tournament_id == tournament_id,
        TournamentAdmin.user_id == target.id,
    ).first()
    if existing:
        return {"message": f"@{username} is already a match admin for this tournament"}

    ta = TournamentAdmin(
        tournament_id=tournament_id,
        user_id=target.id,
        assigned_by=current_user.id,
    )
    db.add(ta)
    db.commit()
    return {"message": f"@{username} assigned as match admin for tournament #{tournament_id}"}


@router.delete("/admin/tournaments/{tournament_id}/assign-match-admin/{user_id}")
def remove_match_admin(
    tournament_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_tournament_manage_access(db, current_user, tournament_id)
    ta = db.query(TournamentAdmin).filter(
        TournamentAdmin.tournament_id == tournament_id,
        TournamentAdmin.user_id == user_id,
    ).first()
    if not ta:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(ta)
    db.commit()
    return {"message": "Match admin removed"}


@router.get("/admin/tournaments/{tournament_id}/admins")
def list_tournament_admins(
    tournament_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_tournament_manage_access(db, current_user, tournament_id)
    admins = db.query(TournamentAdmin).filter(
        TournamentAdmin.tournament_id == tournament_id
    ).all()
    result = []
    for ta in admins:
        u = db.get(User, ta.user_id)
        if u:
            result.append({"user_id": u.id, "username": u.username, "name": u.name})
    return result


# ── Staff/Match Admin — Same endpoints but under /api/staff prefix ────────────

@router.post("/staff/tournaments/{tournament_id}/assign-match-admin")
def staff_assign_match_admin(
    tournament_id: int,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Venue owners and match admins can assign other match admins."""
    require_tournament_manage_access(db, current_user, tournament_id)

    username = payload.get("username", "")
    from app.services.users import get_user_by_username
    target = get_user_by_username(db, username)
    if not target:
        raise HTTPException(status_code=404, detail=f"User @{username} not found")

    # Check if already assigned
    existing = db.query(TournamentAdmin).filter(
        TournamentAdmin.tournament_id == tournament_id,
        TournamentAdmin.user_id == target.id,
    ).first()
    if existing:
        return {"message": f"@{username} is already a match admin for this tournament"}

    ta = TournamentAdmin(
        tournament_id=tournament_id,
        user_id=target.id,
        assigned_by=current_user.id,
    )
    db.add(ta)
    db.commit()
    return {"message": f"@{username} assigned as match admin for tournament #{tournament_id}"}


@router.delete("/staff/tournaments/{tournament_id}/assign-match-admin/{user_id}")
def staff_remove_match_admin(
    tournament_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Venue owners and match admins can remove other match admins."""
    require_tournament_manage_access(db, current_user, tournament_id)
    ta = db.query(TournamentAdmin).filter(
        TournamentAdmin.tournament_id == tournament_id,
        TournamentAdmin.user_id == user_id,
    ).first()
    if not ta:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(ta)
    db.commit()
    return {"message": "Match admin removed"}


@router.get("/staff/tournaments/{tournament_id}/admins")
def staff_list_tournament_admins(
    tournament_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Venue owners and match admins can view all match admins."""
    require_tournament_manage_access(db, current_user, tournament_id)
    admins = db.query(TournamentAdmin).filter(
        TournamentAdmin.tournament_id == tournament_id
    ).all()
    result = []
    for ta in admins:
        u = db.get(User, ta.user_id)
        if u:
            result.append({"user_id": u.id, "username": u.username, "name": u.name})
    return result


# ── Tournament management (stages, bracket, lifecycle) ────────────────────────

@router.get("/admin/tournaments")
def admin_list_tournaments(
    status_filter: str = "",
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Super-admin list — includes drafts and pending approvals."""
    _require_admin(current_user)
    ts = list_tournaments(db, status=status_filter, skip=skip, limit=min(limit, 200))
    return [serialize_tournament(t, db) for t in ts]


@router.get("/admin/tournaments/{tournament_id}/stages")
def list_stages(
    tournament_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = require_tournament_manage_access(db, current_user, tournament_id)
    return [serialize_stage(db, s) for s in t.stages]


@router.post("/admin/tournaments/{tournament_id}/stages", status_code=status.HTTP_201_CREATED)
def create_stage(
    tournament_id: int,
    payload: StageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = require_tournament_manage_access(db, current_user, tournament_id)
    if t.status in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail=f"Tournament is {t.status}")
    data = payload.model_dump()
    data["venue_id"] = data.get("venue_id") or None
    if data["venue_id"] and not db.get(Venue, data["venue_id"]):
        raise HTTPException(status_code=404, detail="Stage venue not found")
    stage = TournamentStage(tournament_id=t.id, **data)
    db.add(stage)
    db.commit()
    db.refresh(stage)
    return serialize_stage(db, stage)


@router.put("/admin/stages/{stage_id}")
def update_stage(
    stage_id: int,
    payload: StageUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stage = db.get(TournamentStage, stage_id)
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")
    require_tournament_manage_access(db, current_user, stage.tournament_id)
    data = payload.model_dump(exclude_unset=True)
    if "venue_id" in data:
        data["venue_id"] = data["venue_id"] or None
        if data["venue_id"] and not db.get(Venue, data["venue_id"]):
            raise HTTPException(status_code=404, detail="Stage venue not found")
    for key, val in data.items():
        setattr(stage, key, val)
    db.commit()
    db.refresh(stage)
    return serialize_stage(db, stage)


@router.delete("/admin/stages/{stage_id}")
def delete_stage(
    stage_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stage = db.get(TournamentStage, stage_id)
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")
    require_tournament_manage_access(db, current_user, stage.tournament_id)
    # matches.stage_id is ON DELETE SET NULL — the bracket serializer groups
    # orphaned rounds under a pseudo-stage, so deletion is always safe
    db.delete(stage)
    db.commit()
    return {"message": "Stage deleted"}


@router.post("/admin/tournaments/{tournament_id}/regenerate-bracket")
def regenerate_bracket(
    tournament_id: int,
    payload: GenerateBracketPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete existing bracket and regenerate with new format. v2"""
    t = require_tournament_manage_access(db, current_user, tournament_id)
    
    # Delete all existing matches for this tournament
    existing_matches = db.query(Match).filter(Match.tournament_id == tournament_id).all()
    for match in existing_matches:
        # Delete match participants
        db.query(MatchParticipant).filter(MatchParticipant.match_id == match.id).delete()
        db.delete(match)
    
    # Clear tournament format if switching
    if payload.format:
        t.format = payload.format
    
    db.commit()
    
    # Generate new bracket
    try:
        generate_bracket(db, tournament_id, current_user.id, payload.round_stage_map or {})
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    return {"message": "Bracket regenerated successfully"}


@router.post("/staff/tournaments/{tournament_id}/regenerate-bracket")
def staff_regenerate_bracket(
    tournament_id: int,
    payload: GenerateBracketPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Staff version of regenerate bracket."""
    return regenerate_bracket(tournament_id, payload, current_user, db)


@router.post("/admin/tournaments/{tournament_id}/generate-bracket")
def generate_bracket_route(
    tournament_id: int,
    payload: GenerateBracketPayload | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = require_tournament_manage_access(db, current_user, tournament_id)
    try:
        generate_bracket(
            db, t.id, current_user.id,
            (payload.round_stage_map if payload else None) or None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return serialize_bracket(t, db)


@router.post("/admin/tournaments/{tournament_id}/block-slots")
def block_tournament_slots(
    tournament_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = require_tournament_manage_access(db, current_user, tournament_id)
    summary = block_stage_slots(db, t)
    return {
        "blocked": summary,
        "conflicts": [row for row in summary if row["existing_bookings"] > 0],
    }


@router.post("/admin/tournaments/{tournament_id}/cancel")
def cancel_tournament_route(
    tournament_id: int,
    payload: dict | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = require_tournament_manage_access(db, current_user, tournament_id)
    try:
        cancel_tournament(db, t, (payload or {}).get("reason", ""))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return serialize_tournament(t, db)


# ── Turf Owner / Match Admin — Staff portal ───────────────────────────────────

@router.get("/staff/my-venue")
def my_venue(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_venue_staff(current_user)
    # include_inactive: a suspended owner must still see their venue (not be
    # funnelled into creating a duplicate), and the UI shows a "Suspended" state.
    v = get_user_venue(db, current_user.id, include_inactive=True)
    if not v:
        return {"venue": None, "message": "No venue found. Create one first."}
    from app.services.venue import list_listings, serialize_listing, get_venue_bookings
    # Owners see inactive (hidden) listings too, so they can re-activate them
    listings = list_listings(db, v.id, include_inactive=True)
    bookings = get_venue_bookings(db, v.id)
    return {
        "venue": serialize_venue(v),
        "listings": [serialize_listing(l) for l in listings],
        "bookings": [
            {
                "id": b.id, "listing_id": b.listing_id,
                "booking_date": b.booking_date, "start_time": b.start_time,
                "end_time": b.end_time, "status": b.status, "user_id": b.user_id,
            }
            for b in bookings
        ],
    }


@router.get("/staff/my-tournaments")
def my_tournaments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_venue_staff(current_user)
    v = get_user_venue(db, current_user.id)
    venue_id = v.id if v else 0

    # Super admins see all tournaments they created
    if current_user.is_admin:
        ts = db.query(Tournament).filter(Tournament.created_by == current_user.id).all()
    else:
        ts = db.query(Tournament).filter(Tournament.venue_id == venue_id).all() if venue_id else []

    return [serialize_tournament(t, db) for t in ts]


@router.get("/staff/assigned-tournaments")
def assigned_tournaments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Tournaments the caller can operate on: super admin → all; venue owner →
    at their venue; match admin → assigned via TournamentAdmin. Non-staff
    users simply get an empty list.
    """
    if current_user.is_admin:
        ts = db.query(Tournament).order_by(Tournament.starts_at.desc()).all()
    else:
        ids: set[int] = set()
        if current_user.is_venue_owner:
            v = get_user_venue(db, current_user.id)
            if v:
                ids |= {
                    row.id for row in
                    db.query(Tournament.id).filter(Tournament.venue_id == v.id).all()
                }
        ids |= {
            row.tournament_id for row in
            db.query(TournamentAdmin.tournament_id)
            .filter(TournamentAdmin.user_id == current_user.id).all()
        }
        if not ids:
            return []
        ts = (
            db.query(Tournament)
            .filter(Tournament.id.in_(ids))
            .order_by(Tournament.starts_at.desc())
            .all()
        )
    for t in ts:
        maybe_auto_cancel(db, t)   # lazy deadline enforcement
    return [serialize_tournament(t, db) for t in ts]


@router.get("/staff/tournaments/{tournament_id}/participants")
def tournament_participants(
    tournament_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not is_tournament_admin(db, current_user, tournament_id):
        raise HTTPException(status_code=403, detail="Not assigned to this tournament")
    import json as _json
    regs = db.query(TournamentRegistration).filter(
        TournamentRegistration.tournament_id == tournament_id
    ).order_by(TournamentRegistration.registered_at.asc()).all()
    result = []
    for r in regs:
        u = db.get(User, r.user_id)
        if not u:
            continue
        team = db.get(Team, r.team_id) if r.team_id else None
        try:
            roster = _json.loads(r.roster_json or "[]")
        except ValueError:
            roster = []
        result.append({
            "user_id": u.id, "username": u.username, "name": u.name,
            "phone": r.contact_phone or u.phone,
            "team_name": team.name if team else "",
            "roster": roster,
            "seed_number": r.seed_number,
            "payment_status": r.payment_status,
            "checked_in_at": r.checked_in_at,
            "checkin_code": r.checkin_code,
            "registered_at": r.registered_at,
        })
    return result


@router.get("/staff/tournaments/{tournament_id}/matches")
def tournament_matches(
    tournament_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not is_tournament_admin(db, current_user, tournament_id):
        raise HTTPException(status_code=403, detail="Not assigned to this tournament")
    matches = db.query(Match).filter(Match.tournament_id == tournament_id).all()
    return [serialize_match(m) for m in matches]


@router.put("/staff/matches/{match_id}")
def edit_match(
    match_id: int,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Edit match details and participant scores."""
    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if not is_tournament_admin(db, current_user, match.tournament_id or 0) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorised to edit this match")
    if match.round_number > 0 and match.status == "completed":
        # A verified bracket match has already advanced its winner —
        # editing scores now would desync results from the bracket
        raise HTTPException(
            status_code=400,
            detail="This bracket match is verified — its result has already advanced",
        )

    # Update match fields (scheduled_at = station-wave scheduling per match).
    # The payload is an untyped dict — clamp strings to their column widths
    # so oversized values can't 500 on Postgres.
    _limits = {"played_at": 30, "match_type": 20, "game_mode": 20, "scheduled_at": 30}
    for field in ("notes", "played_at", "match_type", "game_mode", "scheduled_at"):
        if field in payload:
            value = payload[field]
            if isinstance(value, str) and field in _limits:
                value = value[:_limits[field]]
            setattr(match, field, value)

    # Update participant scores
    if "participants" in payload:
        for p_data in payload["participants"]:
            p = db.query(MatchParticipant).filter(
                MatchParticipant.match_id == match_id,
                MatchParticipant.user_id == p_data.get("user_id"),
            ).first()
            if p:
                for field in ("result", "score", "rank", "kills", "assists", "deaths", "custom_stats"):
                    if field in p_data:
                        setattr(p, field, p_data[field])

    db.commit()
    db.refresh(match)
    return serialize_match(match)


@router.post("/staff/matches/{match_id}/verify")
def staff_verify_match(
    match_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if not is_tournament_admin(db, current_user, match.tournament_id or 0) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorised")
    try:
        match = verify_match(db, match_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return serialize_match(match)


@router.post("/staff/matches/{match_id}/walkover")
def staff_walkover_match(
    match_id: int,
    payload: WalkoverPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Resolve a no-show: chosen side wins, match verifies + advances normally."""
    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if not is_tournament_admin(db, current_user, match.tournament_id or 0) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorised")
    try:
        match = walkover_match(db, match_id, payload.winner_side, current_user.id, payload.reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return serialize_match(match)


# ── Match-day check-in & registration export ──────────────────────────────────

@router.post("/staff/tournaments/{tournament_id}/check-in")
def staff_check_in(
    tournament_id: int,
    payload: CheckInPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not is_tournament_admin(db, current_user, tournament_id):
        raise HTTPException(status_code=403, detail="Not assigned to this tournament")
    try:
        reg = check_in_registration(db, tournament_id, code=payload.code, user_id=payload.user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    u = db.get(User, reg.user_id)
    return {
        "message": f"@{u.username if u else reg.user_id} checked in",
        "user_id": reg.user_id,
        "checked_in_at": reg.checked_in_at,
    }


@router.post("/staff/tournaments/{tournament_id}/remind-checkin")
def staff_remind_checkin(
    tournament_id: int,
    payload: dict = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Send check-in reminder to participants.
    Optional payload: {"user_ids": [1, 2, 3]} to remind specific users only.
    If no payload or user_ids not provided, reminds all non-checked-in participants.
    """
    if not is_tournament_admin(db, current_user, tournament_id):
        raise HTTPException(status_code=403, detail="Not assigned to this tournament")
    
    # Load tournament with venue relationship
    from sqlalchemy.orm import joinedload
    t = db.query(Tournament).options(joinedload(Tournament.venue)).filter(Tournament.id == tournament_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    user_ids = payload.get("user_ids") if payload else None
    notified = remind_checkin(db, t, user_ids=user_ids)
    return {"notified": notified}


@router.get("/staff/tournaments/{tournament_id}/registrations.csv")
def download_registrations_csv(
    tournament_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not is_tournament_admin(db, current_user, tournament_id):
        raise HTTPException(status_code=403, detail="Not assigned to this tournament")
    t = db.get(Tournament, tournament_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    from fastapi import Response
    return Response(
        content=registrations_csv(db, t),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{t.slug}-registrations.csv"'},
    )


# ── Venue-owner tournament creation (draft → approval) ────────────────────────

@router.post("/staff/venue-tournaments", status_code=status.HTTP_201_CREATED)
def create_venue_tournament(
    payload: TournamentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Venue owners create tournaments at their own venue only. They land as
    drafts and need super-admin approval before going public.
    """
    _require_venue_staff(current_user)
    venue = get_user_venue(db, current_user.id)
    if not venue:
        raise HTTPException(status_code=400, detail="Create your venue first")
    if payload.entry_fee_paise:
        raise HTTPException(
            status_code=400,
            detail="Paid entry is not supported yet — keep the entry fee at 0 (free)",
        )
    payload.venue_id = venue.id           # forced: own venue only
    payload.is_featured = False           # platform-level flag stays locked
    payload.registration_open = False     # opens on approval
    t = create_tournament(db, payload, current_user.id)
    return serialize_tournament(t, db)


@router.post("/staff/tournaments/{tournament_id}/submit-for-approval")
def submit_for_approval(
    tournament_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = require_tournament_manage_access(db, current_user, tournament_id)
    try:
        submit_tournament_for_approval(db, t, current_user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return serialize_tournament(t, db)


@router.post("/admin/tournaments/{tournament_id}/approve")
def approve_tournament_route(
    tournament_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    t = db.get(Tournament, tournament_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    try:
        approve_tournament(db, t)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return serialize_tournament(t, db)


@router.post("/admin/tournaments/{tournament_id}/reject")
def reject_tournament_route(
    tournament_id: int,
    payload: dict | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    t = db.get(Tournament, tournament_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    try:
        reject_tournament(db, t, (payload or {}).get("reason", ""))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return serialize_tournament(t, db)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _user_summary(u: User) -> dict:
    return {
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "name": u.name,
        "city": u.city,
        "is_admin": u.is_admin,
        "is_venue_owner": u.is_venue_owner,
        "is_active": u.is_active,
        "is_verified": u.is_verified,
        "avatar_url": u.avatar_url,
        "created_at": u.created_at,
    }



# ── Bracket Format Suggestions ────────────────────────────────────────────────

@router.get("/admin/tournaments/{tournament_id}/format-suggestions")
def get_format_suggestions(
    tournament_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Suggest best tournament formats based on participant count."""
    t = require_tournament_manage_access(db, current_user, tournament_id)
    
    # Count checked-in participants
    checked_in = db.query(TournamentRegistration).filter(
        TournamentRegistration.tournament_id == tournament_id,
        TournamentRegistration.checked_in_at != None
    ).count()
    
    suggestions = []
    
    if checked_in < 3:
        return {
            "tournament_id": tournament_id,
            "checked_in_count": checked_in,
            "suggestions": [{
                "format": "not_enough",
                "name": "Not Enough Participants",
                "description": "Need at least 3 checked-in participants to generate a bracket",
                "total_matches": 0,
                "recommended": False,
                "pros": [],
                "cons": ["Not enough players"],
            }]
        }
    
    # Round robin (everyone plays everyone) - works for any count, MOST FAIR
    rr_matches = (checked_in * (checked_in - 1)) // 2
    suggestions.append({
        "format": "round_robin",
        "name": "Round Robin (League)",
        "description": "Everyone plays everyone once - most fair format",
        "total_matches": rr_matches,
        "recommended": checked_in >= 3 and checked_in <= 10,
        "pros": ["Most fair", "Everyone plays everyone", "True ranking", "No eliminations", "Best format for small groups"],
        "cons": ["Many matches" if checked_in > 6 else "Takes time", "No dramatic finals"],
    })
    
    # Single elimination (knockout) - works for any count (with byes for odd numbers)
    knockout_rounds = 0
    temp = checked_in
    while temp > 1:
        temp = (temp + 1) // 2
        knockout_rounds += 1
    
    has_byes = checked_in != 2 ** int(checked_in).bit_length() - 1
    bye_note = " (some players get byes in round 1)" if has_byes else ""
    
    suggestions.append({
        "format": "knockout",
        "name": "Single Elimination (Knockout)",
        "description": f"{knockout_rounds} rounds, winner advances{bye_note}",
        "total_matches": checked_in - 1 if checked_in > 0 else 0,
        "recommended": checked_in >= 8 and checked_in <= 32,
        "pros": ["Fast", "Every match matters", "Clear winner", "Exciting", "Quick tournament"],
        "cons": ["Players eliminated after 1 loss", "No second chances", "Unequal match counts with byes"],
    })
    
    # Page Playoff System (for exactly 4-6 players) - FAIR and EFFICIENT
    if checked_in >= 4 and checked_in <= 6:
        # Page System: Top 4 after qualification/seeding
        # Match 1: Seed 1 vs Seed 2 (winner to final)
        # Match 2: Seed 3 vs Seed 4 (loser eliminated)
        # Match 3: Loser of Match 1 vs Winner of Match 2
        # Match 4: Final
        suggestions.append({
            "format": "page_playoff",
            "name": f"Page Playoff System",
            "description": "Top seeds get advantage: 1v2 winner goes to final, 3v4 loser eliminated, others compete for final spot",
            "total_matches": 4 if checked_in == 4 else (rr_matches // 2 + 4),
            "recommended": checked_in >= 4 and checked_in <= 6,
            "pros": ["Fair with seeding advantage", "Everyone plays 2-3 matches", "Efficient", "Rewards top seeds"],
            "cons": ["Requires proper seeding", "Complex for participants to understand"],
        })
    
    # Double Elimination (for 6+ players)
    if checked_in >= 6:
        # Winners bracket + Losers bracket
        de_matches = (checked_in - 1) * 2 - 1  # Approximate
        suggestions.append({
            "format": "double_elimination",
            "name": "Double Elimination",
            "description": "Lose twice to be eliminated - winners & losers bracket",
            "total_matches": de_matches,
            "recommended": checked_in >= 8 and checked_in <= 24,
            "pros": ["Second chances", "More matches per player", "Fairer than single elimination"],
            "cons": ["Complex bracket", "Takes longer", "Can be confusing"],
        })
    
    # Group stage + knockout (for 8+ players)
    if checked_in >= 8:
        num_groups = 2 if checked_in < 16 else 4
        per_group = checked_in // num_groups
        group_matches = num_groups * (per_group * (per_group - 1)) // 2
        knockout_players = num_groups * 2  # Top 2 from each group
        knockout_matches = knockout_players - 1
        total = group_matches + knockout_matches
        
        suggestions.append({
            "format": "group_knockout",
            "name": f"Group Stage ({num_groups} groups) + Knockout",
            "description": f"{num_groups} groups of ~{per_group}, top 2 advance to knockout",
            "total_matches": total,
            "recommended": checked_in >= 12 and checked_in <= 64,
            "pros": ["Everyone plays multiple matches", "Fair seeding for knockout", "Exciting finals", "Like World Cup"],
            "cons": ["More matches", "Takes longer", "Requires scheduling"],
            "config": {
                "num_groups": num_groups,
                "per_group": per_group,
                "advance_from_group": 2
            }
        })
    
    # Swiss System (for 8+ players) - good for many participants
    if checked_in >= 8:
        swiss_rounds = min(5, checked_in // 2)  # Typically 4-5 rounds
        swiss_matches = checked_in * swiss_rounds // 2
        suggestions.append({
            "format": "swiss",
            "name": f"Swiss System ({swiss_rounds} rounds)",
            "description": "Players paired by similar records, no elimination",
            "total_matches": swiss_matches,
            "recommended": checked_in >= 16 and checked_in <= 128,
            "pros": ["No elimination", "Everyone plays same number", "Efficient", "Fair pairing"],
            "cons": ["Requires live pairing", "Complex to organize", "Not yet implemented"],
        })
    
    # Sort by recommended, then by match count
    suggestions.sort(key=lambda x: (not x.get("recommended", False), x.get("total_matches", 999)))
    
    return {
        "tournament_id": tournament_id,
        "checked_in_count": checked_in,
        "suggestions": suggestions
    }


@router.get("/staff/tournaments/{tournament_id}/format-suggestions")
def staff_get_format_suggestions(
    tournament_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Staff version of format suggestions."""
    return get_format_suggestions(tournament_id, current_user, db)


@router.post("/staff/tournaments/{tournament_id}/generate-bracket")
def staff_generate_bracket_route(
    tournament_id: int,
    payload: GenerateBracketPayload | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Staff version of generate bracket - supports multiple formats."""
    if not is_tournament_admin(db, current_user, tournament_id):
        raise HTTPException(status_code=403, detail="Not assigned to this tournament")
    t = db.get(Tournament, tournament_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    format_choice = payload.format if payload else "knockout"
    
    # Different formats use different generation functions
    if format_choice == "round_robin":
        # Round robin: everyone plays everyone using group generation
        from app.services.groups import generate_groups
        try:
            # For free tournaments, auto-mark all registrations as paid
            if t.entry_fee_paise == 0:
                db.query(TournamentRegistration).filter(
                    TournamentRegistration.tournament_id == tournament_id,
                    TournamentRegistration.payment_status == "unpaid"
                ).update({"payment_status": "paid"})
                db.commit()
            
            # Set format FIRST (before calling generate_groups which checks format)
            t.format = "round_robin"
            t.format_type = "round_robin"
            db.commit()
            db.refresh(t)  # Refresh to get updated format
            
            # Count paid participants (generate_groups uses payment_status)
            paid_count = db.query(TournamentRegistration).filter(
                TournamentRegistration.tournament_id == tournament_id,
                TournamentRegistration.payment_status == "paid"
            ).count()
            
            if paid_count < 2:
                raise HTTPException(
                    status_code=400,
                    detail=f"Need at least 2 paid participants to generate bracket (found {paid_count})"
                )
            
            groups, total_matches = generate_groups(
                db, t,
                num_groups=1,  # Single group = everyone plays everyone
                advance_per_group=max(1, paid_count),  # Everyone advances (no elimination)
                points_win=3,
                points_draw=1,
                points_loss=0,
            )
            return {
                "message": f"Round robin generated with {total_matches} matches",
                "format": "round_robin",
                "total_matches": total_matches,
            }
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    elif format_choice in ["knockout", "page_playoff", "swiss"]:
        # These all use knockout bracket generation
        try:
            t.format = "knockout"
            t.format_type = "knockout"
            db.commit()
            
            generate_bracket(
                db, t.id, current_user.id,
                (payload.round_stage_map if payload else None) or None,
            )
            return serialize_bracket(t, db)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Format '{format_choice}' not yet implemented. Use 'knockout' or 'round_robin'."
        )


# ── Group Stage Routes ────────────────────────────────────────────────────────

from pydantic import BaseModel

class GenerateGroupsPayload(BaseModel):
    num_groups: int
    advance_per_group: int = 2
    points_win: int = 3
    points_draw: int = 1
    points_loss: int = 0


@router.post("/admin/tournaments/{tournament_id}/generate-groups")
def generate_groups_route(
    tournament_id: int,
    payload: GenerateGroupsPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate groups and round-robin matches for a group-stage tournament.
    
    - Creates N groups
    - Distributes participants evenly
    - Generates round-robin matches within each group
    - Sets tournament phase to 'group_stage'
    """
    from app.services.groups import generate_groups
    
    t = require_tournament_manage_access(db, current_user, tournament_id)
    
    try:
        groups, total_matches = generate_groups(
            db, t,
            num_groups=payload.num_groups,
            advance_per_group=payload.advance_per_group,
            points_win=payload.points_win,
            points_draw=payload.points_draw,
            points_loss=payload.points_loss,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    return {
        "message": f"Generated {len(groups)} groups with {total_matches} matches",
        "groups": [
            {
                "id": g.id,
                "name": g.group_name,
                "order": g.group_order,
            }
            for g in groups
        ],
        "total_matches": total_matches,
    }


@router.get("/admin/tournaments/{tournament_id}/groups")
def get_tournament_groups(
    tournament_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all groups and their standings for a tournament.
    """
    from app.services.groups import get_group_standings
    
    # Anyone can view public tournament groups
    t = db.get(Tournament, tournament_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    return get_group_standings(db, tournament_id)


@router.post("/admin/tournaments/{tournament_id}/complete-group-stage")
def complete_group_stage_route(
    tournament_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Complete the group stage and generate knockout bracket with group winners.
    
    - Verifies all group matches are complete
    - Finalizes group standings
    - Advances top N from each group
    - Generates knockout bracket
    - Sets phase to 'knockout'
    """
    from app.services.groups import complete_group_stage
    
    t = require_tournament_manage_access(db, current_user, tournament_id)
    
    try:
        complete_group_stage(db, t, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    return {
        "message": f"Group stage completed — knockout bracket generated",
        "phase": t.current_phase,
        "status": t.status,
    }


@router.post("/admin/tournaments/{tournament_id}/recalculate-group-standings")
def recalculate_group_standings_route(
    tournament_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    DEBUG ENDPOINT: Recalculate group standings from all verified matches.
    """
    from app.services.groups import update_group_standings
    from sqlalchemy import text
    import json
    
    t = require_tournament_manage_access(db, current_user, tournament_id)
    
    # Get all verified group stage matches
    matches = db.query(Match).filter(
        Match.tournament_id == tournament_id,
        Match.match_phase == "group_stage",
        Match.status == "completed"
    ).all()
    
    group_config = json.loads(t.group_config or "{}")
    
    # Reset all group members
    db.execute(text("""
        UPDATE tournament_group_members
        SET points = 0, wins = 0, losses = 0, draws = 0,
            goals_for = 0, goals_against = 0, matches_played = 0
        WHERE group_id IN (
            SELECT id FROM tournament_groups WHERE tournament_id = :tournament_id
        )
    """), {"tournament_id": tournament_id})
    
    # Recalculate standings for each match
    count = 0
    for match in matches:
        if match.group_id:
            print(f"📊 Recalculating match {match.id} in group {match.group_id}")
            update_group_standings(db, match, group_config)
            count += 1
    
    db.commit()
    
    return {
        "success": True,
        "matches_processed": count,
        "message": f"Recalculated standings from {count} verified matches"
    }
