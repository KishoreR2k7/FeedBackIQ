"""Authentication and session management services."""

from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.auth import User
from app.models.audit import AuditLog
from app.core.security import verify_password, hash_password, create_session_token, verify_session_token


def authenticate_user(
    db: Session,
    email: str,
    password: str,
    org_id: Optional[int] = None
) -> Optional[User]:
    """Authenticate user credentials using Argon2 password verification."""
    clean_email = email.strip().lower()
    query = db.query(User).filter(User.email == clean_email)
    if org_id:
        query = query.filter(User.org_id == org_id)
    user = query.first()
    
    if not user:
        return None
    if not getattr(user, "active", getattr(user, "is_active", True)):
        return None
    pw_hash = getattr(user, "pw_hash", getattr(user, "hashed_password", ""))
    if not verify_password(password, pw_hash):
        return None
    return user


def build_user_session(user: User) -> str:
    """Generate signed session token containing user and authoritative tenant org_id."""
    payload = {
        "user_id": user.id,
        "org_id": user.org_id,
        "email": user.email,
        "name": getattr(user, "name", getattr(user, "full_name", "")),
        "full_name": getattr(user, "full_name", getattr(user, "name", "")),
        "is_superuser": user.is_superuser,
        "must_change_pw": getattr(user, "must_change_pw", False)
    }
    return create_session_token(payload)


def change_user_password(
    db: Session,
    user: User,
    current_password: str,
    new_password: str
) -> bool:
    """Validate current password and update to new Argon2 hashed password."""
    pw_hash = getattr(user, "pw_hash", getattr(user, "hashed_password", ""))
    if not verify_password(current_password, pw_hash):
        return False
    if not new_password or len(new_password) < 8:
        raise ValueError("New password must be at least 8 characters long")
        
    new_hash = hash_password(new_password)
    user.pw_hash = new_hash
    user.must_change_pw = False
    
    # Audit log
    audit = AuditLog(
        org_id=user.org_id,
        user_id=user.id,
        action="user.password_changed",
        entity_type="user",
        entity_id=user.id,
        details={"status": "success"}
    )
    db.add(audit)
    db.commit()
    db.refresh(user)
    return True
