"""SQLAlchemy 2.0 Database configuration with psycopg 3."""

from typing import Generator, Optional
from fastapi import Request
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
from app.core.config import settings

# Create engine with psycopg 3
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=False,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


def set_request_org_context(db: Session, org_id: int) -> None:
    """Set app.current_org on the DB session for tenant isolation (Rule 7)."""
    try:
        db.execute(text("SELECT set_config('app.current_org', :org_id, false)"), {"org_id": str(org_id)})
    except Exception:
        pass


def set_local_org(db: Session, org_id: int) -> None:
    """Explicitly execute SET LOCAL app.current_org = <org_id> in the current transaction."""
    try:
        db.execute(text(f"SET LOCAL app.current_org = '{org_id}'"))
    except Exception:
        set_request_org_context(db, org_id)


def get_db(request: Request = None) -> Generator[Session, None, None]:
    """FastAPI dependency for scoped database sessions.
    
    Extracts tenant context from verified session and sets app.current_org (Rule 7).
    """
    db = SessionLocal()
    try:
        if request is not None:
            token = request.cookies.get("fiq_session")
            if token:
                try:
                    from app.core.security import verify_session_token
                    payload = verify_session_token(token)
                    if payload and "org_id" in payload:
                        set_request_org_context(db, payload["org_id"])
                except Exception:
                    pass
        yield db
    finally:
        db.close()
