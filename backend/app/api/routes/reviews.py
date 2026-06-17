"""
Reviews routes.

Public:
  GET  /api/reviews?venue_id={id}   list reviews for a venue (ordered newest first)

Authenticated:
  POST /api/reviews                 submit a review for a venue
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.match import Review
from app.models.user import User
from app.schemas.match import ReviewCreate, ReviewRead

router = APIRouter()


# ── GET /reviews ──────────────────────────────────────────────────────────────

@router.get("/reviews", response_model=list[ReviewRead])
def list_reviews(venue_id: int, db: Session = Depends(get_db)):
    """
    Return all reviews for the given venue, newest first.
    Returns an empty list for an unknown venue_id.
    """
    rows = (
        db.query(Review, User.username)
        .join(User, User.id == Review.user_id)
        .filter(Review.venue_id == venue_id)
        .order_by(Review.created_at.desc())
        .all()
    )

    result: list[ReviewRead] = []
    for review, username in rows:
        result.append(
            ReviewRead(
                id=review.id,
                venue_id=review.venue_id,
                listing_id=review.listing_id,
                user_id=review.user_id,
                username=username,
                rating=review.rating,
                comment=review.comment,
                is_verified_visit=review.is_verified_visit,
                created_at=review.created_at,
            )
        )
    return result


# ── POST /reviews ─────────────────────────────────────────────────────────────

@router.post("/reviews", response_model=ReviewRead, status_code=status.HTTP_201_CREATED)
def create_review(
    payload: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Submit a review for a venue.  One review per user per venue.
    Raises 409 if the user has already reviewed this venue.
    """
    existing = (
        db.query(Review)
        .filter(Review.user_id == current_user.id, Review.venue_id == payload.venue_id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already reviewed this venue.",
        )

    review = Review(
        venue_id=payload.venue_id,
        user_id=current_user.id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    return ReviewRead(
        id=review.id,
        venue_id=review.venue_id,
        listing_id=review.listing_id,
        user_id=review.user_id,
        username=current_user.username,
        rating=review.rating,
        comment=review.comment,
        is_verified_visit=review.is_verified_visit,
        created_at=review.created_at,
    )
