import json
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import EmailOtp, User
from app.schemas.auth import ProfilePayload, SignupStartRequest
from app.services.email import send_otp_email


def _dump(value: list[str]) -> str:
    return json.dumps(value)


def _load(value: str) -> list[str]:
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "name": user.name,
        "display_name": user.display_name,
        "gender": user.gender,
        "date_of_birth": user.date_of_birth,
        "phone": user.phone,
        "city": user.city,
        "state": user.state,
        "postal_code": user.postal_code,
        "interests": _load(user.interests),
        "ranked_interests": _load(user.ranked_interests),
        "bio": user.bio,
        "avatar_url": user.avatar_url,
        "photo_url": user.photo_url,
        "auth_provider": user.auth_provider,
        "is_admin": user.is_admin,
        "is_verified": user.is_verified,
        "is_venue_owner": user.is_venue_owner,
        "created_at": user.created_at,
        "profile_edit_date": user.profile_edit_date,
        "profile_edits_today": user.profile_edits_today,
    }


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email.lower()).first()


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username.lower()).first()


def get_user_by_identifier(db: Session, identifier: str) -> User | None:
    clean = identifier.strip().lower()
    if "@" in clean:
        return get_user_by_email(db, clean)
    return get_user_by_username(db, clean)


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def create_signup_otp(db: Session, payload: SignupStartRequest) -> str:
    code = f"{random.randint(100000, 999999)}"
    email = payload.email.lower()
    username = payload.username.lower()
    db.query(EmailOtp).filter(EmailOtp.email == email, EmailOtp.consumed == False).update({"consumed": True})  # noqa: E712
    otp = EmailOtp(
        email=email,
        username=username,
        hashed_password=hash_password(payload.password),
        otp_code=code,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    db.add(otp)
    db.commit()
    send_otp_email(email, code, "signup")
    return code


def create_password_reset_otp(db: Session, user: User) -> str:
    code = f"{random.randint(100000, 999999)}"
    db.query(EmailOtp).filter(EmailOtp.email == user.email, EmailOtp.consumed == False).update({"consumed": True})  # noqa: E712
    otp = EmailOtp(
        email=user.email,
        username=user.username,
        hashed_password=user.hashed_password or "",
        otp_code=code,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    db.add(otp)
    db.commit()
    send_otp_email(user.email, code, "password reset")
    return code


def reset_password_with_otp(db: Session, user: User, code: str, new_password: str) -> bool:
    otp = (
        db.query(EmailOtp)
        .filter(EmailOtp.email == user.email, EmailOtp.consumed == False)  # noqa: E712
        .order_by(EmailOtp.created_at.desc())
        .first()
    )
    if not otp:
        return False
    now = datetime.now(timezone.utc)
    expires_at = otp.expires_at if otp.expires_at.tzinfo else otp.expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now or otp.attempts >= 5:
        otp.consumed = True
        db.commit()
        return False
    otp.attempts += 1
    if otp.otp_code != code:
        db.commit()
        return False
    user.hashed_password = hash_password(new_password)
    user.auth_provider = "password"
    otp.consumed = True
    db.commit()
    return True


def consume_signup_otp(db: Session, email: str, code: str) -> User | None:
    otp = (
        db.query(EmailOtp)
        .filter(EmailOtp.email == email.lower(), EmailOtp.consumed == False)  # noqa: E712
        .order_by(EmailOtp.created_at.desc())
        .first()
    )
    if not otp:
        return None
    now = datetime.now(timezone.utc)
    expires_at = otp.expires_at if otp.expires_at.tzinfo else otp.expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now or otp.attempts >= 5:
        otp.consumed = True
        db.commit()
        return None
    otp.attempts += 1
    if otp.otp_code != code:
        db.commit()
        return None
    if get_user_by_email(db, otp.email) or get_user_by_username(db, otp.username):
        otp.consumed = True
        db.commit()
        return None
    user = User(
        email=otp.email,
        username=otp.username,
        hashed_password=otp.hashed_password,
        auth_provider="password",
    )
    otp.consumed = True
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def available_google_username(db: Session, email: str) -> str:
    base = email.split("@", 1)[0].lower()
    base = "".join(ch for ch in base if ch.isalnum() or ch == "_").strip("_")[:16] or "champion"
    username = base
    suffix = 1
    while get_user_by_username(db, username):
        suffix += 1
        username = f"{base[:14]}{suffix}"
    return username


def upsert_google_user(db: Session, email: str, name: str = "", avatar_url: str = "") -> User:
    user = get_user_by_email(db, email)
    if user:
        user.auth_provider = "google"
        if name and not user.name:
            user.name = name
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
    else:
        user = User(
            email=email.lower(),
            username=available_google_username(db, email),
            auth_provider="google",
            hashed_password=None,
            name=name,
            avatar_url=avatar_url,
        )
        db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, identifier: str, password: str) -> User | None:
    user = get_user_by_identifier(db, identifier)
    if not user or not user.hashed_password:
        return None
    return user if verify_password(password, user.hashed_password) else None


def apply_profile(user: User, payload: ProfilePayload) -> None:
    ranked = payload.ranked_interests or payload.interests
    user.name = payload.name
    user.display_name = payload.display_name
    user.gender = payload.gender
    user.date_of_birth = payload.date_of_birth
    user.phone = payload.phone
    user.city = payload.city
    user.state = payload.state
    user.postal_code = payload.postal_code
    user.interests = json.dumps(payload.interests)
    user.ranked_interests = json.dumps(ranked)
    user.bio = payload.bio
