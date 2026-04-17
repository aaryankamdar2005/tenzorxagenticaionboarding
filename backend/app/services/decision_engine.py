"""
Final AI decision engine.
Aggregates all KYC signals and calls Llama-3 to produce a confidence score.
Persists the audit result to MongoDB.
"""
from __future__ import annotations

import logging

from app.models.schemas import AuditScore
from app.services.db import get_database, log_event, utc_now
from app.services.groq_client import generate_final_score

logger = logging.getLogger(__name__)


async def compute_and_save_final_score(session_id: str) -> AuditScore:
    """
    Fetch all session signals from MongoDB, run AI scoring, and persist.
    """
    db = get_database()
    doc = await db["sessions"].find_one({"session_id": session_id})

    if not doc:
        logger.warning("compute_final_score: session %s not found", session_id)
        return AuditScore(
            confidence_score=0,
            approval_recommendation="MANUAL_REVIEW",
            reasons=["Session document not found in database"],
        )

    kyc_fields: dict = doc.get("latest_extraction") or {}
    avg_age: float | None = doc.get("best_age_estimate")  # WS router saves as best_age_estimate
    liveness: dict = doc.get("liveness_result") or {}
    doc_verify: dict = doc.get("document_verification") or {}
    geo: dict = doc.get("geo_result") or {}

    score = await generate_final_score(
        kyc_fields=kyc_fields,
        avg_age=avg_age,
        liveness_passed=liveness.get("passed", False),
        ocr_match_score=doc_verify.get("match_score", 0.0),
        geo_mismatch=geo.get("is_mismatch", False),
        stress_flag=kyc_fields.get("stress_flag", False),
    )

    # Persist final score into the session document
    await db["sessions"].update_one(
        {"session_id": session_id},
        {
            "$set": {
                "final_score": score.model_dump(),
                "review_status": "PENDING",
                "state": "SCORED",
                "scored_at": utc_now(),
            }
        },
    )

    await log_event(
        "audit_logs",
        {
            "session_id": session_id,
            "event": "FINAL_SCORE_COMPUTED",
            "payload": score.model_dump(),
        },
    )

    return score
