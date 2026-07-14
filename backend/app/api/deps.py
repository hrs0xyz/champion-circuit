from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.match import Tournament, TournamentAdmin
from app.models.user import User
from app.services.users import get_user_by_id

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    subject = decode_access_token(token)
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")
    user = get_user_by_id(db, int(subject))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_optional_user(
    token: str = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db),
) -> User | None:
    """Returns the current user if authenticated, None otherwise."""
    if not token:
        return None
    subject = decode_access_token(token)
    if not subject:
        return None
    user = get_user_by_id(db, int(subject))
    return user if user and user.is_active else None


# ── Tournament access guards (shared by matches.py and admin.py routes) ───────

def is_tournament_admin(db: Session, user: User, tournament_id: int) -> bool:
    """Returns True if user is super admin or assigned match admin for this tournament."""
    if user.is_admin:
        return True
    return db.query(TournamentAdmin).filter(
        TournamentAdmin.tournament_id == tournament_id,
        TournamentAdmin.user_id == user.id,
    ).first() is not None


def require_tournament_manage_access(db: Session, user: User, tournament_id: int) -> Tournament:
    """
    Gate for managing a tournament (edit, stages, bracket, match admins).
    Super admin: any tournament. Venue owner: only tournaments at their own venue.
    Returns the tournament or raises 403/404.
    """
    from app.services.venue import get_user_venue

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

