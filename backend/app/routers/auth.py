"""
Auth router — customer & banker registration/login.
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
"""
from __future__ import annotations

import logging
from typing import Annotated

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.models.schemas import TokenResponse, UserLoginRequest, UserRegisterRequest
from app.services.auth import check_password, create_token, decode_token, hash_password
from app.services.db import get_database, utc_now

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── JWT dependency ────────────────────────────────────────────────────────────

async def get_current_user(authorization: Annotated[str | None, Header()] = None):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        return decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Token invalid or expired")


# ── Register ──────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse)
async def register(body: UserRegisterRequest):
    db = get_database()
    existing = await db["users"].find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    doc = {
        "name": body.name,
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "role": body.role.value,
        "pan_number": body.pan_number.upper() if body.pan_number else None,
        "created_at": utc_now(),
    }
    result = await db["users"].insert_one(doc)
    user_id = str(result.inserted_id)

    token = create_token(user_id, body.email.lower(), body.role.value, body.name)
    return TokenResponse(access_token=token, role=body.role, name=body.name, user_id=user_id)


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
async def login(body: UserLoginRequest):
    db = get_database()
    user = await db["users"].find_one({"email": body.email.lower()})
    if not user or not check_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = str(user["_id"])
    token = create_token(user_id, user["email"], user["role"], user["name"])
    return TokenResponse(
        access_token=token,
        role=user["role"],
        name=user["name"],
        user_id=user_id,
    )


# ── Me ────────────────────────────────────────────────────────────────────────

@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    db = get_database()
    user = await db["users"].find_one({"_id": ObjectId(current_user["sub"])})
    pan = user.get("pan_number") if user else None

    return {
        "user_id": current_user["sub"],
        "email": current_user["email"],
        "role": current_user["role"],
        "name": current_user["name"],
        "pan_number": pan
    }
