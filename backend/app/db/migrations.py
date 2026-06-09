from sqlalchemy import inspect, text

from app.db.session import engine


def ensure_dev_schema() -> None:
    if not engine.url.drivername.startswith("sqlite"):
        return

    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("users")}
    statements: list[str] = []
    if "username" not in columns:
        statements.append("ALTER TABLE users ADD COLUMN username VARCHAR(40)")
    for column, definition in {
        "name": "VARCHAR(120) DEFAULT ''",
        "city": "VARCHAR(120) DEFAULT ''",
        "postal_code": "VARCHAR(20) DEFAULT ''",
        "avatar_url": "VARCHAR(500) DEFAULT ''",
        "photo_url": "VARCHAR(500) DEFAULT ''",
        "profile_edit_date": "VARCHAR(10) DEFAULT ''",
        "profile_edits_today": "INTEGER DEFAULT 0",
    }.items():
        if column not in columns:
            statements.append(f"ALTER TABLE users ADD COLUMN {column} {definition}")

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
        if "username" not in columns:
            rows = connection.execute(text("SELECT id, email FROM users WHERE username IS NULL OR username = ''")).fetchall()
            for row in rows:
                base = row.email.split("@", 1)[0].lower()
                base = "".join(ch for ch in base if ch.isalnum() or ch in "._").strip("._")[:18] or "champion"
                username = base
                suffix = 1
                while connection.execute(text("SELECT id FROM users WHERE username = :username"), {"username": username}).fetchone():
                    suffix += 1
                    username = f"{base[:18]}{suffix}"
                connection.execute(text("UPDATE users SET username = :username WHERE id = :id"), {"username": username, "id": row.id})
            connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)"))
