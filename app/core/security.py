"""Security utilities: Argon2 password hashing, CSRF tokens, and auth sessions."""

import hmac
import hashlib
import time
import base64
import json
from typing import Optional, Dict, Any
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError

from app.core.config import settings

# Initialize Argon2 Hasher with secure defaults
_hasher = PasswordHasher(
    time_cost=2,
    memory_cost=19456,  # 19 MiB
    parallelism=1,
    hash_len=32,
    salt_len=16
)


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    return _hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against an Argon2 hash."""
    try:
        return _hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def needs_rehash(hashed_password: str) -> bool:
    """Check if the hash needs upgrading."""
    try:
        return _hasher.check_needs_rehash(hashed_password)
    except Exception:
        return False


# CSRF Protection using HMAC-SHA256 Token Signature
def generate_csrf_token(session_id: str) -> str:
    """Generate a time-bound CSRF token bound to a session identifier."""
    timestamp = int(time.time())
    message = f"{session_id}:{timestamp}".encode("utf-8")
    sig = hmac.new(
        settings.CSRF_SECRET_KEY.encode("utf-8"),
        message,
        hashlib.sha256
    ).hexdigest()
    payload = f"{session_id}:{timestamp}:{sig}"
    return base64.urlsafe_b64encode(payload.encode("utf-8")).decode("utf-8")


def verify_csrf_token(token: str, session_id: str, max_age_seconds: int = 7200) -> bool:
    """Verify validity, expiration, and signature of a CSRF token."""
    if not token or not session_id:
        return False
    try:
        raw = base64.urlsafe_b64decode(token.encode("utf-8")).decode("utf-8")
        parts = raw.split(":")
        if len(parts) != 3:
            return False
        tok_session, tok_time_str, tok_sig = parts
        if tok_session != session_id:
            return False
        tok_time = int(tok_time_str)
        now = int(time.time())
        if now - tok_time > max_age_seconds or tok_time > now + 300:
            return False
        expected_msg = f"{tok_session}:{tok_time}".encode("utf-8")
        expected_sig = hmac.new(
            settings.CSRF_SECRET_KEY.encode("utf-8"),
            expected_msg,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(tok_sig, expected_sig)
    except Exception:
        return False


# Session Token Generation and Decoding
def create_session_token(payload: Dict[str, Any], expires_delta_seconds: Optional[int] = None) -> str:
    """Create a tamper-proof signed session token using HMAC-SHA256."""
    expires_in = expires_delta_seconds or (settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    data = payload.copy()
    data["exp"] = int(time.time()) + expires_in
    data["iat"] = int(time.time())
    
    payload_bytes = json.dumps(data, separators=(",", ":"), sort_keys=True).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(payload_bytes).decode("utf-8").rstrip("=")
    
    signature = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    
    return f"{payload_b64}.{signature}"


def verify_session_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify and decode a signed session token."""
    if not token or "." not in token:
        return None
    try:
        payload_b64, signature = token.split(".", 1)
        expected_sig = hmac.new(
            settings.SECRET_KEY.encode("utf-8"),
            payload_b64.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(signature, expected_sig):
            return None
            
        rem = len(payload_b64) % 4
        if rem > 0:
            payload_b64 += "=" * (4 - rem)
        raw_bytes = base64.urlsafe_b64decode(payload_b64.encode("utf-8"))
        data = json.loads(raw_bytes.decode("utf-8"))
        
        if data.get("exp", 0) < time.time():
            return None
        return data
    except Exception:
        return None
