import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv(override=True)

import urllib.parse

def clean_database_url(url: str) -> str:
    if not url:
        return url
    parts = url.split("://", 1)
    if len(parts) < 2:
        return url
    scheme, rest = parts
    if "@" in rest:
        cred_host_split = rest.rsplit("@", 1)
        cred = cred_host_split[0]
        host_path = cred_host_split[1]
        if ":" in cred:
            user, pwd = cred.split(":", 1)
            # Safe characters like '/' are not in credentials anyway.
            # We unquote first to prevent double-encoding.
            encoded_user = urllib.parse.quote(urllib.parse.unquote(user))
            encoded_pwd = urllib.parse.quote(urllib.parse.unquote(pwd))
            cleaned_rest = f"{encoded_user}:{encoded_pwd}@{host_path}"
        else:
            encoded_cred = urllib.parse.quote(urllib.parse.unquote(cred))
            cleaned_rest = f"{encoded_cred}@{host_path}"
        url = f"{scheme}://{cleaned_rest}"
    return url

# Get the database URL from the environment
DATABASE_URL = clean_database_url(os.getenv("DATABASE_URL"))

from sqlalchemy import event

# If no DATABASE_URL is provided, fallback to local SQLite for development
if not DATABASE_URL:
    SQLALCHEMY_DATABASE_URL = "sqlite:///./flashcards.db"
    # connect_args={"check_same_thread": False} is needed only for SQLite
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False, "timeout": 30}
    )
    
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()
else:
    # SQLAlchemy 1.4+ requires "postgresql://" instead of "postgres://"
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
    elif DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
        
    SQLALCHEMY_DATABASE_URL = DATABASE_URL
    # For PostgreSQL (Supabase/Neon), configure optimized pool limits for high concurrency
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_size=15,
        max_overflow=25,
        pool_pre_ping=True,
        pool_recycle=300,
        connect_args={"connect_timeout": 10},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

from sqlalchemy import text

def upgrade_db_schema(engine):
    # Check and add columns to user_stats table
    columns_to_add = [
        ("time_spent_studying", "INTEGER DEFAULT 0"),
        ("success_generations", "INTEGER DEFAULT 0"),
        ("failed_generations", "INTEGER DEFAULT 0"),
        ("processing_status", "VARCHAR DEFAULT 'Idle'")
    ]
    for col_name, col_type in columns_to_add:
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE user_stats ADD COLUMN {col_name} {col_type}"))
                print(f"Database upgrade: Added column '{col_name}' to 'user_stats' table.")
        except Exception as e:
            # Column likely already exists, ignore
            pass

    # Use TIMESTAMP for PostgreSQL and DATETIME for SQLite to prevent migration failures
    db_type = "TIMESTAMP" if engine.name == "postgresql" else "DATETIME"

    flashcard_columns_to_add = [
        ("due", f"{db_type} DEFAULT NULL"),
        ("stability", "FLOAT DEFAULT 0.0"),
        ("difficulty", "FLOAT DEFAULT 0.0"),
        ("elapsed_days", "INTEGER DEFAULT 0"),
        ("scheduled_days", "INTEGER DEFAULT 0"),
        ("reps", "INTEGER DEFAULT 0"),
        ("lapses", "INTEGER DEFAULT 0"),
        ("state", "INTEGER DEFAULT 0"),
        ("last_review", f"{db_type} DEFAULT NULL")
    ]
    for col_name, col_type in flashcard_columns_to_add:
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE flashcards ADD COLUMN {col_name} {col_type}"))
                print(f"Database upgrade: Added column '{col_name}' to 'flashcards' table.")
        except Exception as e:
            pass

    # Check and add columns to flashcard_sets table
    flashcard_set_columns_to_add = [
        ("room_id", "INTEGER DEFAULT NULL")
    ]
    for col_name, col_type in flashcard_set_columns_to_add:
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE flashcard_sets ADD COLUMN {col_name} {col_type}"))
                print(f"Database upgrade: Added column '{col_name}' to 'flashcard_sets' table.")
        except Exception as e:
            pass
