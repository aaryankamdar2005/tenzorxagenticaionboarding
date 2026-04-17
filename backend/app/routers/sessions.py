from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException

from app.models.schemas import SessionCreateRequest, SessionResponse
from app.services.auth import decode_token
from app.services.db import get_database, log_event, utc_now

router = APIRouter(prefix="/api", tags=["sessions"])


async def _optional_user(authorization: Annotated[str | None, Header()] = None) -> dict | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        return decode_token(authorization.split(" ", 1)[1])
    except Exception:
        return None


@router.post("/sessions", response_model=SessionResponse)
async def create_session(
    payload: SessionCreateRequest,
    user: dict | None = Depends(_optional_user),
) -> SessionResponse:
    session_id = str(uuid.uuid4())
    db = get_database()

    doc: dict[str, Any] = {
        "session_id": session_id,
        "source": payload.source,
        "state": "INITIALIZED",
        "created_at": utc_now(),
        "review_status": "PENDING",
    }
    if user:
        doc["user_id"] = user["sub"]
        doc["customer_name"] = user.get("name", "")
        doc["customer_email"] = user.get("email", "")

    await db["sessions"].insert_one(doc)
    await log_event("audit_logs", {
        "session_id": session_id,
        "event": "SESSION_CREATED",
        "payload": payload.model_dump(),
    })
    return SessionResponse(session_id=session_id)


@router.get("/sessions/{session_id}")
async def get_session(session_id: str) -> dict:
    db = get_database()
    session = await db["sessions"].find_one({"session_id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(404, "Session not found")
    return session


@router.post("/sessions/{session_id}/submit")
async def submit_session(session_id: str) -> dict:
    import asyncio
    from app.services.decision_engine import compute_and_save_final_score

    db = get_database()
    result = await db["sessions"].update_one(
        {"session_id": session_id},
        {"$set": {"state": "SUBMITTED", "submitted_at": utc_now()}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Session not found")

    await log_event("audit_logs", {"session_id": session_id, "event": "SESSION_SUBMITTED"})

    # Trigger AI final scoring asynchronously (don't block the HTTP response)
    async def _run_scoring():
        try:
            await compute_and_save_final_score(session_id)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning("Final scoring failed for %s: %s", session_id, exc)

    asyncio.create_task(_run_scoring())

    return {"status": "success"}



# ── Customer: view own applications ──────────────────────────────────────────

async def _require_token(authorization: Annotated[str | None, Header()] = None) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required")
    try:
        return decode_token(authorization.split(" ", 1)[1])
    except Exception:
        raise HTTPException(401, "Token invalid or expired")


@router.get("/customer/sessions")
async def get_customer_sessions(user: dict = Depends(_require_token)) -> list[dict]:
    db = get_database()
    cursor = db["sessions"].find(
        {"user_id": user["sub"]},
        {"_id": 0, "session_id": 1, "state": 1, "review_status": 1, "created_at": 1,
         "latest_offer": 1, "latest_extraction": 1, "final_score": 1,
         "biometric_data": 1, "age_verification": 1},
        sort=[("created_at", -1)],
    ).limit(50)
    return [doc async for doc in cursor]
