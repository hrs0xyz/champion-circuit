"""
User Activity Tracking
POST /api/activity          — log an event (logged-in users only)
GET  /api/activity/mine     — my own activity
GET  /api/admin/activity    — all activity (admin only)
GET  /api/staff/activity    — activity for my venue (venue owner)
GET  /api/admin/activity/export  — CSV export (admin only)
"""
import csv
import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User

router = APIRouter()


# ── Log an event ──────────────────────────────────────────────────────────────

@router.post("/activity", status_code=201)
def log_activity(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Payload fields (all optional except event):
      event: str          — venue_view | listing_inquiry | sport_filter | city_filter |
                            voucher_view | voucher_purchase | booking | venue_card_click
      venue_id: int
      venue_name: str
      sport: str
      city: str
      listing_id: int
      listing_title: str
      extra: str
    """
    event = (payload.get("event") or "").strip()
    if not event:
        return {"message": "ignored"}

    db.execute(text("""
        INSERT INTO user_activity
            (user_id, username, event, venue_id, venue_name, sport, city,
             listing_id, listing_title, extra, created_at)
        VALUES
            (:user_id, :username, :event, :venue_id, :venue_name, :sport, :city,
             :listing_id, :listing_title, :extra, :created_at)
    """), {
        "user_id": current_user.id,
        "username": current_user.username or "",
        "event": event,
        "venue_id": payload.get("venue_id"),
        "venue_name": payload.get("venue_name", ""),
        "sport": payload.get("sport", ""),
        "city": payload.get("city", ""),
        "listing_id": payload.get("listing_id"),
        "listing_title": payload.get("listing_title", ""),
        "extra": payload.get("extra", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    db.commit()
    return {"message": "logged"}


# ── My own activity ───────────────────────────────────────────────────────────

@router.get("/activity/mine")
def my_activity(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.execute(text("""
        SELECT id, event, venue_id, venue_name, sport, city,
               listing_id, listing_title, extra, created_at
        FROM user_activity
        WHERE user_id = :uid
        ORDER BY created_at DESC
        LIMIT :limit
    """), {"uid": current_user.id, "limit": min(limit, 200)}).fetchall()
    return [dict(r._mapping) for r in rows]


# ── Admin — all activity ──────────────────────────────────────────────────────

@router.get("/admin/activity")
def all_activity(
    event: str = "",
    venue_id: int = 0,
    sport: str = "",
    city: str = "",
    username: str = "",
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.is_admin:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin only")

    filters = ["1=1"]
    params: dict = {"skip": skip, "limit": min(limit, 500)}

    if event:
        filters.append("event = :event")
        params["event"] = event
    if venue_id:
        filters.append("venue_id = :venue_id")
        params["venue_id"] = venue_id
    if sport:
        filters.append("sport = :sport")
        params["sport"] = sport
    if city:
        filters.append("city LIKE :city")
        params["city"] = f"%{city}%"
    if username:
        filters.append("username LIKE :username")
        params["username"] = f"%{username}%"

    where = " AND ".join(filters)
    rows = db.execute(text(f"""
        SELECT id, user_id, username, event, venue_id, venue_name, sport, city,
               listing_id, listing_title, extra, created_at
        FROM user_activity
        WHERE {where}
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :skip
    """), params).fetchall()

    total = db.execute(text(f"""
        SELECT COUNT(*) FROM user_activity WHERE {where}
    """), {k: v for k, v in params.items() if k not in ("skip", "limit")}).scalar()

    return {"total": total, "rows": [dict(r._mapping) for r in rows]}


# ── Admin — summary stats for dashboard ──────────────────────────────────────

@router.get("/admin/activity/summary")
def activity_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.is_admin:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin only")

    # Top venues by views
    top_venues = db.execute(text("""
        SELECT venue_name, venue_id, COUNT(*) as views
        FROM user_activity
        WHERE event = 'venue_view' AND venue_id IS NOT NULL
        GROUP BY venue_id, venue_name
        ORDER BY views DESC
        LIMIT 10
    """)).fetchall()

    # Top sports by filter clicks
    top_sports = db.execute(text("""
        SELECT sport, COUNT(*) as clicks
        FROM user_activity
        WHERE event = 'sport_filter' AND sport != '' AND sport != 'all'
        GROUP BY sport
        ORDER BY clicks DESC
        LIMIT 10
    """)).fetchall()

    # Top cities
    top_cities = db.execute(text("""
        SELECT city, COUNT(*) as selections
        FROM user_activity
        WHERE event = 'city_filter' AND city != ''
        GROUP BY city
        ORDER BY selections DESC
        LIMIT 10
    """)).fetchall()

    # Inquiry funnel: views vs inquiries per venue
    funnel = db.execute(text("""
        SELECT venue_name, venue_id,
            SUM(CASE WHEN event='venue_view' THEN 1 ELSE 0 END) as views,
            SUM(CASE WHEN event='listing_inquiry' THEN 1 ELSE 0 END) as inquiries
        FROM user_activity
        WHERE venue_id IS NOT NULL AND venue_name != ''
        GROUP BY venue_id, venue_name
        ORDER BY views DESC
        LIMIT 15
    """)).fetchall()

    # Recent active users
    recent_users = db.execute(text("""
        SELECT username, COUNT(*) as actions, MAX(created_at) as last_seen
        FROM user_activity
        GROUP BY username
        ORDER BY last_seen DESC
        LIMIT 10
    """)).fetchall()

    return {
        "top_venues": [dict(r._mapping) for r in top_venues],
        "top_sports": [dict(r._mapping) for r in top_sports],
        "top_cities": [dict(r._mapping) for r in top_cities],
        "funnel": [dict(r._mapping) for r in funnel],
        "recent_users": [dict(r._mapping) for r in recent_users],
    }


# ── Admin — CSV export ────────────────────────────────────────────────────────

@router.get("/admin/activity/export")
def export_csv(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.is_admin:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin only")

    rows = db.execute(text("""
        SELECT id, user_id, username, event, venue_id, venue_name,
               sport, city, listing_id, listing_title, extra, created_at
        FROM user_activity
        ORDER BY created_at DESC
        LIMIT 10000
    """)).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "user_id", "username", "event", "venue_id", "venue_name",
        "sport", "city", "listing_id", "listing_title", "extra", "created_at"
    ])
    for r in rows:
        writer.writerow(list(r))

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=cc_activity.csv"},
    )


# ── Venue owner — activity for their venue ───────────────────────────────────

@router.get("/staff/activity")
def venue_activity(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.is_venue_owner and not current_user.is_admin:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Venue owner only")

    from app.services.venue import get_user_venue
    my_venue = get_user_venue(db, current_user.id)
    if not my_venue and not current_user.is_admin:
        return {"venue_id": None, "rows": []}

    venue_filter = f"venue_id = {my_venue.id}" if my_venue else "1=1"

    rows = db.execute(text(f"""
        SELECT id, username, event, venue_name, sport, city,
               listing_title, created_at
        FROM user_activity
        WHERE {venue_filter}
        ORDER BY created_at DESC
        LIMIT 200
    """)).fetchall()

    # Summary stats
    summary = db.execute(text(f"""
        SELECT
            COUNT(*) as total_events,
            SUM(CASE WHEN event='venue_view' THEN 1 ELSE 0 END) as views,
            SUM(CASE WHEN event='listing_inquiry' THEN 1 ELSE 0 END) as inquiries,
            COUNT(DISTINCT username) as unique_users
        FROM user_activity
        WHERE {venue_filter}
    """)).fetchone()

    return {
        "venue_id": my_venue.id if my_venue else None,
        "summary": dict(summary._mapping) if summary else {},
        "rows": [dict(r._mapping) for r in rows],
    }
