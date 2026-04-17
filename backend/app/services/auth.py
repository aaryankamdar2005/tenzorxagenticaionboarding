"""
Simple auth service using bcrypt + HS256 JWT.
No external auth providers — fully self-contained.
"""
from __future__ import annotations

import os
import time
from typing import Any

import bcrypt
import jwt

_SECRET = os.getenv("JWT_SECRET", "securebank-super-secret-key-change-in-prod")
_ALGO = "HS256"
_TTL = 60 * 60 * 24 * 7   # 7 days


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def check_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str, email: str, role: str, name: str) -> str:
    payload: dict[str, Any] = {
        "sub": user_id,
        "email": email,
        "role": role,
        "name": name,
        "iat": int(time.time()),
        "exp": int(time.time()) + _TTL,
    }
    return jwt.encode(payload, _SECRET, algorithm=_ALGO)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, _SECRET, algorithms=[_ALGO])
