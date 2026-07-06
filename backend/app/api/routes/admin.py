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

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.match import Match, MatchParticipant, Tournament, TournamentAdmin, TournamentRegistration
from app.models.user import User
from app.models.venue import Venue
from app.services.match import create_match, serialize_match, verify_match
from app.services.venue import get_user_venue, serialize_venue

router = APIRouter()


def _require_admin(user: User) -> None:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Super admin access required")


def _require_venue_staff(user: User) -> None:
    if not user.is_venue_owner and not user.is_admin:
        raise HTTPException(status_code=403, detail="Venue owner access required")


def _is_tournament_admin(db: Session, user: User, tournament_id: int) -> bool:
    """Returns True if user is super admin or assigned match admin for this tournament."""
    if user.is_admin:
        return True
    return db.query(TournamentAdmin).filter(
        TournamentAdmin.tournament_id == tournament_id,
        TournamentAdmin.user_id == user.id,
    ).first() is not None


def _require_tournament_manage_access(db: Session, user: User, tournament_id: int) -> Tournament:
    """
    Gate for managing a tournament's match admins.
    Super admin: any tournament. Venue owner: only tournaments at their own venue.
    Returns the tournament or raises 403/404.
    """
    if not user.is_admin and not user.is_venue_owner:
        raise HTTPException(status_code=403, detail="Not authorised")
    t = db.get(Tournament, tournament_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if not user.is_admin:
        my_venue = get_user_venue(db, user.id)
        if not my_venue or t.venue_id != my_venue.id:
            raise HTTPException(status_code=403, detail="You can only manage your own tournaments")
    return t


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
    _require_tournament_manage_access(db, current_user, tournament_id)

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
    _require_tournament_manage_access(db, current_user, tournament_id)
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
    _require_tournament_manage_access(db, current_user, tournament_id)
    admins = db.query(TournamentAdmin).filter(
        TournamentAdmin.tournament_id == tournament_id
    ).all()
    result = []
    for ta in admins:
        u = db.get(User, ta.user_id)
        if u:
            result.append({"user_id": u.id, "username": u.username, "name": u.name})
    return result


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

    from app.services.match import serialize_tournament
    return [serialize_tournament(t, db) for t in ts]


@router.get("/staff/tournaments/{tournament_id}/participants")
def tournament_participants(
    tournament_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _is_tournament_admin(db, current_user, tournament_id):
        raise HTTPException(status_code=403, detail="Not assigned to this tournament")
    regs = db.query(TournamentRegistration).filter(
        TournamentRegistration.tournament_id == tournament_id
    ).all()
    result = []
    for r in regs:
        u = db.get(User, r.user_id)
        if u:
            result.append({
                "user_id": u.id, "username": u.username, "name": u.name,
                "payment_status": r.payment_status, "registered_at": r.registered_at,
            })
    return result


@router.get("/staff/tournaments/{tournament_id}/matches")
def tournament_matches(
    tournament_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _is_tournament_admin(db, current_user, tournament_id):
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
    if not _is_tournament_admin(db, current_user, match.tournament_id or 0) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorised to edit this match")

    # Update match fields
    for field in ("notes", "played_at", "match_type", "game_mode"):
        if field in payload:
            setattr(match, field, payload[field])

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
    if not _is_tournament_admin(db, current_user, match.tournament_id or 0) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorised")
    try:
        match = verify_match(db, match_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return serialize_match(match)


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
