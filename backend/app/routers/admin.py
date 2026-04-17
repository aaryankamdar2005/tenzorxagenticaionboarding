"""
Admin API router.
GET  /api/admin/sessions          — paginated session list
GET  /api/admin/sessions/{id}     — full session detail
POST /api/admin/sessions/{id}/review — update review status
"""
from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.db import get_database, log_event, utc_now

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])

ReviewAction = Literal["APPROVED", "REJECTED", "FLAGGED"]


class ReviewPayload(BaseModel):
    action: ReviewAction
    notes: str | None = None


def _serialize(doc: dict) -> dict:
    """Remove MongoDB _id ObjectId for JSON serialisation."""
    doc.pop("_id", None)
    # Convert datetimes to ISO strings
    for k, v in doc.items():
        if hasattr(v, "isoformat"):
            doc[k] = v.isoformat()
    return doc


@router.get("/sessions")
async def list_sessions(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> dict:
    db = get_database()
    skip = (page - 1) * limit
    cursor = db["sessions"].find(
        {},
        {
            "session_id": 1,
            "source": 1,
            "state": 1,
            "review_status": 1,
            "created_at": 1,
            "submitted_at": 1,
            "final_score": 1,
            "latest_extraction": 1,
            "latest_offer": 1,
            "best_age_estimate": 1,
            "biometric_passed": 1,
            "liveness_result": 1,
        },
    ).sort("created_at", -1).skip(skip).limit(limit)

    docs = [_serialize(doc) async for doc in cursor]
    total = await db["sessions"].count_documents({})

    return {"sessions": docs, "total": total, "page": page, "limit": limit}


@router.get("/sessions/{session_id}")
async def get_session(session_id: str) -> dict:
    db = get_database()
    doc = await db["sessions"].find_one({"session_id": session_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")

    # Fetch last 50 transcript entries
    transcripts = []
    async for t in db["transcripts"].find(
        {"session_id": session_id}, {"_id": 0}
    ).sort("created_at", 1).limit(50):
        if hasattr(t.get("created_at"), "isoformat"):
            t["created_at"] = t["created_at"].isoformat()
        transcripts.append(t)

    result = _serialize(doc)
    result["transcripts"] = transcripts
    return result


@router.post("/sessions/{session_id}/review")
async def update_review(session_id: str, payload: ReviewPayload) -> dict:
    db = get_database()
    doc = await db["sessions"].find_one({"session_id": session_id}, {"_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")

    update: dict = {
        "review_status": payload.action,
        "reviewed_at": utc_now(),
    }
    if payload.notes:
        update["review_notes"] = payload.notes

    await db["sessions"].update_one({"session_id": session_id}, {"$set": update})
    await log_event("audit_logs", {
        "session_id": session_id,
        "event": f"HUMAN_REVIEW_{payload.action}",
        "payload": {"notes": payload.notes},
    })

    return {"ok": True, "status": payload.action}
