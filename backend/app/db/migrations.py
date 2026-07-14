"""
Hand-rolled migrations for SQLite.
Called on every startup — safe to run multiple times (idempotent).
"""
from sqlalchemy import inspect, text
from app.db.session import engine


def _add_column(connection, table: str, column: str, definition: str) -> None:
    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))


# Tournament-feature columns added to pre-existing tables. New tables
# (tournament_stages, tournament_waitlist) come from Base.metadata.create_all,
# which main.py runs *before* ensure_dev_schema() — so FK targets always exist
# by the time these ALTERs run.
_MATCH_BRACKET_COLS = {
    "stage_id":         "INTEGER REFERENCES tournament_stages(id) ON DELETE SET NULL",
    "round_number":     "INTEGER DEFAULT 0 NOT NULL",
    "bracket_position": "INTEGER DEFAULT 0 NOT NULL",
    "next_match_id":    "INTEGER REFERENCES matches(id) ON DELETE SET NULL",
    "next_match_slot":  "VARCHAR(1) DEFAULT '' NOT NULL",
    "is_bye":           "BOOLEAN DEFAULT FALSE NOT NULL",
    "scheduled_at":     "VARCHAR(30) DEFAULT '' NOT NULL",
}

_TOURNAMENT_NEW_COLS = {
    "min_participants":          "INTEGER DEFAULT 0 NOT NULL",
    "awards_leaderboard_points": "BOOLEAN DEFAULT TRUE NOT NULL",
}

_REGISTRATION_NEW_COLS = {
    "checked_in_at": "VARCHAR(30) DEFAULT '' NOT NULL",
    "checkin_code":  "VARCHAR(12) DEFAULT '' NOT NULL",
    "contact_name":  "VARCHAR(120) DEFAULT '' NOT NULL",
    "contact_phone": "VARCHAR(20) DEFAULT '' NOT NULL",
    "roster_json":   "TEXT DEFAULT '[]' NOT NULL",
}


def _sqlite_defn(defn: str) -> str:
    """SQLite has no BOOLEAN/TRUE/FALSE literals — map to INTEGER 0/1."""
    return (
        defn.replace("BOOLEAN", "INTEGER")
            .replace("DEFAULT TRUE", "DEFAULT 1")
            .replace("DEFAULT FALSE", "DEFAULT 0")
    )


def _ensure_postgres_schema() -> None:
    """
    Lightweight idempotent migrations for Postgres (this project doesn't use
    Alembic). Safe to run on every startup.
    """
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    with engine.begin() as conn:
        # venue_cover_photos table
        if "venue_cover_photos" not in tables:
            conn.execute(text("""
                CREATE TABLE venue_cover_photos (
                    id          SERIAL PRIMARY KEY,
                    venue_id    INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
                    url         VARCHAR(500) NOT NULL,
                    sort_order  INTEGER DEFAULT 1 NOT NULL,
                    uploaded_at TIMESTAMPTZ DEFAULT NOW()
                )
            """))
            conn.execute(text("CREATE INDEX ix_venue_cover_photos_venue_id ON venue_cover_photos(venue_id)"))

        # listings.capacity: int -> varchar (now stores "10" or a range "5-10")
        if "listings" in tables:
            col = next(
                (c for c in inspector.get_columns("listings") if c["name"] == "capacity"),
                None,
            )
            if col is not None and "int" in str(col["type"]).lower():
                conn.execute(text(
                    "ALTER TABLE listings ALTER COLUMN capacity "
                    "TYPE VARCHAR(20) USING capacity::varchar"
                ))
                conn.execute(text(
                    "ALTER TABLE listings ALTER COLUMN capacity SET DEFAULT ''"
                ))
                conn.execute(text(
                    "UPDATE listings SET capacity = '' WHERE capacity IS NULL OR capacity = '0'"
                ))

        # news_articles.body / cover_url / tags / published_at / summary:
        # were created as VARCHAR(30) from an old model; must be TEXT / larger VARCHAR.
        if "news_articles" in tables:
            for col_name, new_type, cast in [
                ("body",         "TEXT",         "body::text"),
                ("cover_url",    "VARCHAR(500)",  "cover_url::varchar"),
                ("summary",      "VARCHAR(500)",  "summary::varchar"),
                ("tags",         "VARCHAR(300)",  "tags::varchar"),
                ("published_at", "VARCHAR(50)",   "published_at::varchar"),
                ("slug",         "VARCHAR(160)",  "slug::varchar"),
                ("category",     "VARCHAR(40)",   "category::varchar"),
            ]:
                col_info = next(
                    (c for c in inspector.get_columns("news_articles") if c["name"] == col_name),
                    None,
                )
                if col_info is None:
                    continue
                col_type_str = str(col_info["type"]).upper()
                # Check if it's too small (VARCHAR with length <= 30 or < target)
                needs_upgrade = False
                if "TEXT" in col_type_str and new_type == "TEXT":
                    needs_upgrade = False  # already TEXT
                elif "CHARACTER VARYING" in col_type_str or "VARCHAR" in col_type_str:
                    try:
                        current_len = int(str(col_info["type"]).split("(")[1].rstrip(")"))
                        target_len = int(new_type.split("(")[1].rstrip(")")) if "(" in new_type else 999999
                        needs_upgrade = current_len < target_len
                    except (IndexError, ValueError):
                        needs_upgrade = True
                elif col_type_str == "TEXT":
                    needs_upgrade = False
                else:
                    needs_upgrade = True

                if new_type == "TEXT" and "TEXT" not in col_type_str:
                    needs_upgrade = True

                if needs_upgrade:
                    conn.execute(text(
                        f"ALTER TABLE news_articles ALTER COLUMN {col_name} "
                        f"TYPE {new_type} USING {cast}"
                    ))

        # ── Tournament feature: bracket fields + registration hardening ────────
        if "matches" in tables:
            existing = {c["name"] for c in inspector.get_columns("matches")}
            for col, defn in _MATCH_BRACKET_COLS.items():
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE matches ADD COLUMN IF NOT EXISTS {col} {defn}"))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_matches_stage_id ON matches(stage_id)"
            ))

        if "tournaments" in tables:
            existing = {c["name"] for c in inspector.get_columns("tournaments")}
            for col, defn in _TOURNAMENT_NEW_COLS.items():
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS {col} {defn}"))

        if "tournament_registrations" in tables:
            existing = {c["name"] for c in inspector.get_columns("tournament_registrations")}
            for col, defn in _REGISTRATION_NEW_COLS.items():
                if col not in existing:
                    conn.execute(text(
                        f"ALTER TABLE tournament_registrations ADD COLUMN IF NOT EXISTS {col} {defn}"
                    ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_tournament_registrations_checkin_code "
                "ON tournament_registrations(checkin_code)"
            ))
            # De-dupe (keep the earliest row) before enforcing uniqueness.
            conn.execute(text(
                "DELETE FROM tournament_registrations a USING tournament_registrations b "
                "WHERE a.id > b.id AND a.tournament_id = b.tournament_id AND a.user_id = b.user_id"
            ))
            conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_registration_user "
                "ON tournament_registrations(tournament_id, user_id)"
            ))


def ensure_dev_schema() -> None:
    if engine.url.drivername.startswith("postgresql"):
        _ensure_postgres_schema()
        return
    if not engine.url.drivername.startswith("sqlite"):
        return

    inspector = inspect(engine)
    tables = inspector.get_table_names()

    with engine.begin() as conn:

        # ── users ──────────────────────────────────────────────────────────────
        if "users" in tables:
            cols = {c["name"] for c in inspector.get_columns("users")}

            new_user_cols = {
                "username":          "VARCHAR(40)",
                "display_name":      "VARCHAR(120) DEFAULT ''",
                "gender":            "VARCHAR(30) DEFAULT ''",
                "date_of_birth":     "VARCHAR(10) DEFAULT ''",
                "phone":             "VARCHAR(20) DEFAULT ''",
                "phone_verified":    "INTEGER DEFAULT 0",
                "state":             "VARCHAR(120) DEFAULT ''",
                "country":           "VARCHAR(60) DEFAULT 'India'",
                "postal_code":       "VARCHAR(20) DEFAULT ''",
                "avatar_url":        "VARCHAR(500) DEFAULT ''",
                "photo_url":         "VARCHAR(500) DEFAULT ''",
                "profile_edit_date": "VARCHAR(10) DEFAULT ''",
                "profile_edits_today": "INTEGER DEFAULT 0",
                "is_verified":       "INTEGER DEFAULT 0",
                "is_venue_owner":    "INTEGER DEFAULT 0",
                "city":              "VARCHAR(120) DEFAULT ''",
                "name":              "VARCHAR(120) DEFAULT ''",
                "bio":               "TEXT DEFAULT ''",
                "interests":         "TEXT DEFAULT '[]'",
                "ranked_interests":  "TEXT DEFAULT '[]'",
            }

            for col, defn in new_user_cols.items():
                if col not in cols:
                    _add_column(conn, "users", col, defn)

            # Back-fill username from email if missing
            if "username" not in cols:
                rows = conn.execute(
                    text("SELECT id, email FROM users WHERE username IS NULL OR username = ''")
                ).fetchall()
                for row in rows:
                    base = row.email.split("@", 1)[0].lower()
                    base = "".join(c for c in base if c.isalnum() or c == "_").strip("_")[:16] or "champion"
                    candidate = base
                    n = 1
                    while conn.execute(
                        text("SELECT id FROM users WHERE username = :u"), {"u": candidate}
                    ).fetchone():
                        n += 1
                        candidate = f"{base[:14]}{n}"
                    conn.execute(
                        text("UPDATE users SET username = :u WHERE id = :id"),
                        {"u": candidate, "id": row.id},
                    )
                conn.execute(
                    text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)")
                )

        # ── reviews ────────────────────────────────────────────────────────────
        if "reviews" in tables:
            review_cols = {c["name"] for c in inspector.get_columns("reviews")}
            if "venue_id" not in review_cols:
                _add_column(conn, "reviews", "venue_id",
                            "INTEGER REFERENCES venues(id) ON DELETE SET NULL")

        # ── user_activity ──────────────────────────────────────────────────────
        if "user_activity" not in tables:
            conn.execute(text("""
                CREATE TABLE user_activity (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    username    VARCHAR(40) DEFAULT '',
                    event       VARCHAR(60) NOT NULL,
                    venue_id    INTEGER,
                    venue_name  VARCHAR(200) DEFAULT '',
                    sport       VARCHAR(60) DEFAULT '',
                    city        VARCHAR(120) DEFAULT '',
                    listing_id  INTEGER,
                    listing_title VARCHAR(200) DEFAULT '',
                    extra       VARCHAR(500) DEFAULT '',
                    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text("CREATE INDEX ix_activity_user_id ON user_activity(user_id)"))
            conn.execute(text("CREATE INDEX ix_activity_event ON user_activity(event)"))
            conn.execute(text("CREATE INDEX ix_activity_venue_id ON user_activity(venue_id)"))
            conn.execute(text("CREATE INDEX ix_activity_created_at ON user_activity(created_at)"))

        # ── venue_cover_photos ─────────────────────────────────────────────────
        if "venue_cover_photos" not in tables:
            conn.execute(text("""
                CREATE TABLE venue_cover_photos (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    venue_id    INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
                    url         VARCHAR(500) NOT NULL,
                    sort_order  INTEGER DEFAULT 1 NOT NULL,
                    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text("CREATE INDEX ix_venue_cover_photos_venue_id ON venue_cover_photos(venue_id)"))

        # ── Tournament feature: bracket fields + registration hardening ────────
        if "matches" in tables:
            match_cols = {c["name"] for c in inspector.get_columns("matches")}
            for col, defn in _MATCH_BRACKET_COLS.items():
                if col not in match_cols:
                    _add_column(conn, "matches", col, _sqlite_defn(defn))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_matches_stage_id ON matches(stage_id)"
            ))

        if "tournaments" in tables:
            t_cols = {c["name"] for c in inspector.get_columns("tournaments")}
            for col, defn in _TOURNAMENT_NEW_COLS.items():
                if col not in t_cols:
                    _add_column(conn, "tournaments", col, _sqlite_defn(defn))

        if "tournament_registrations" in tables:
            reg_cols = {c["name"] for c in inspector.get_columns("tournament_registrations")}
            for col, defn in _REGISTRATION_NEW_COLS.items():
                if col not in reg_cols:
                    _add_column(conn, "tournament_registrations", col, _sqlite_defn(defn))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_tournament_registrations_checkin_code "
                "ON tournament_registrations(checkin_code)"
            ))
            # De-dupe (keep the earliest row) before enforcing uniqueness.
            conn.execute(text(
                "DELETE FROM tournament_registrations WHERE id NOT IN "
                "(SELECT MIN(id) FROM tournament_registrations GROUP BY tournament_id, user_id)"
            ))
            conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_registration_user "
                "ON tournament_registrations(tournament_id, user_id)"
            ))
