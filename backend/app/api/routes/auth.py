from fastapi import APIRouter, Depends, HTTPException, status
from google.auth.transport import requests
from google.oauth2 import id_token
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    GoogleAuthRequest,
    INTERESTS,
    ForgotPasswordStartRequest,
    ForgotPasswordVerifyRequest,
    LoginRequest,
    PasswordOtpResponse,
    SignupStartRequest,
    SignupStartResponse,
    SignupVerifyRequest,
    TokenResponse,
    UsernameAvailability,
)
from app.schemas.user import UserRead
from app.services.users import (
    authenticate_user,
    consume_signup_otp,
    create_password_reset_otp,
    create_signup_otp,
    get_user_by_email,
    get_user_by_identifier,
    get_user_by_username,
    reset_password_with_otp,
    serialize_user,
    upsert_google_user,
)
from app.services.email import send_welcome_email

router = APIRouter()


def token_for(user: User) -> TokenResponse:
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.get("/interests")
def interests() -> dict[str, list[str]]:
    return {"interests": INTERESTS}


@router.get("/username/{username}", response_model=UsernameAvailability)
def username_available(username: str, db: Session = Depends(get_db)) -> UsernameAvailability:
    clean = username.strip().lower()
    available = len(clean) >= 4 and len(clean) <= 16 and clean.replace("_", "").isalnum() and not get_user_by_username(db, clean)
    return UsernameAvailability(username=clean, available=available)


@router.post("/signup/start", response_model=SignupStartResponse)
def signup_start(payload: SignupStartRequest, db: Session = Depends(get_db)) -> SignupStartResponse:
    if get_user_by_email(db, payload.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")
    if get_user_by_username(db, payload.username):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already taken")
    otp = create_signup_otp(db, payload)
    return SignupStartResponse(message="OTP sent to your email.", dev_otp=otp if settings.ENVIRONMENT == "local" else None)


@router.post("/signup/verify", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup_verify(payload: SignupVerifyRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = consume_signup_otp(db, payload.email, payload.otp)
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OTP")
    # Send welcome email (fire-and-forget — don't block on email failure)
    try:
        send_welcome_email(user.email, user.username, user.name or "")
    except Exception:
        pass
    return token_for(user)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = authenticate_user(db, payload.identifier, payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email/username or password")
    return token_for(user)


@router.post("/password/forgot", response_model=PasswordOtpResponse)
def forgot_password(payload: ForgotPasswordStartRequest, db: Session = Depends(get_db)) -> PasswordOtpResponse:
    user = get_user_by_identifier(db, payload.identifier)
    if not user:
        return PasswordOtpResponse(message="If the account exists, an OTP has been sent.", dev_otp=None)
    otp = create_password_reset_otp(db, user)
    return PasswordOtpResponse(message="If the account exists, an OTP has been sent.", dev_otp=otp if settings.ENVIRONMENT == "local" else None)


@router.post("/password/reset")
def reset_password(payload: ForgotPasswordVerifyRequest, db: Session = Depends(get_db)) -> dict[str, str]:
    user = get_user_by_identifier(db, payload.identifier)
    if not user or not reset_password_with_otp(db, user, payload.otp, payload.new_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OTP")
    return {"message": "Password updated"}


@router.post("/google", response_model=TokenResponse)
def google_login(payload: GoogleAuthRequest, db: Session = Depends(get_db)) -> TokenResponse:
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google login is not configured")
    try:
        claims = id_token.verify_oauth2_token(payload.id_token, requests.Request(), settings.GOOGLE_CLIENT_ID)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token") from exc
    email = claims.get("email")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google account email is required")
    return token_for(upsert_google_user(db, email, claims.get("name", ""), claims.get("picture", "")))


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> dict:
    return serialize_user(current_user)
