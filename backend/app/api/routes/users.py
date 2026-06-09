from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.core.security import verify_password
from app.schemas.auth import ProfileUpdateRequest
from app.schemas.user import UserRead
from app.services.users import apply_profile, serialize_user

router = APIRouter()


@router.put("/me", response_model=UserRead)
def update_me(payload: ProfileUpdateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    if not current_user.hashed_password or not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is required to edit profile")

    today = date.today().isoformat()
    if current_user.profile_edit_date == today and current_user.profile_edits_today >= 1:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Profile can be edited once per day")

    apply_profile(current_user, payload)
    if current_user.profile_edit_date == today:
        current_user.profile_edits_today += 1
    else:
        current_user.profile_edit_date = today
        current_user.profile_edits_today = 1
    db.commit()
    db.refresh(current_user)
    return serialize_user(current_user)
