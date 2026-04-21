"""
Mock Credit Bureau — deterministic CIBIL report from PAN number.
GET /api/bureau/credit-report/{pan_number}
"""
from __future__ import annotations

import hashlib
from datetime import date, datetime, timedelta

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.models.schemas import BureauReport

router = APIRouter(prefix="/api/bureau", tags=["bureau"])


def _deterministic_int(pan: str, lo: int, hi: int, salt: str = "") -> int:
    """Hash-based deterministic integer in [lo, hi]."""
    digest = hashlib.sha256(f"{pan.upper()}{salt}".encode()).digest()
    raw = int.from_bytes(digest[:4], "big")
    return lo + (raw % (hi - lo + 1))


@router.get("/credit-report/{pan_number}", response_model=BureauReport)
async def get_credit_report(pan_number: str) -> JSONResponse:
    pan = pan_number.upper().strip()

    cibil_score = _deterministic_int(pan, 300, 900, "cibil")
    active_trade_lines = _deterministic_int(pan, 0, 12, "trades")
    default_flag_val = _deterministic_int(pan, 0, 99, "defaults")
    historical_defaults = cibil_score <= 450 or default_flag_val < 15
    
    # Generic deterministic defaults
    recent_hard_inquiries = _deterministic_int(pan, 0, 2, "inquiries")
    active_loans_monthly_emi = float(_deterministic_int(pan, 0, 30000, "emi"))
    
    has_previous = _deterministic_int(pan, 0, 100, "has_prev") < 15
    last_application_status = None
    last_application_date = None
    
    if has_previous:
        status_choice = _deterministic_int(pan, 0, 2, "status")
        last_application_status = ["APPROVED", "REJECTED", "PENDING"][status_choice]
        days_ago = _deterministic_int(pan, 200, 400, "days_ago") # outside 6 months
        last_application_date = (datetime.now() - timedelta(days=days_ago)).isoformat()
        
    # Manual overrides for UI testing
    if "COOL" in pan:
        last_application_status = "REJECTED"
        days_ago = _deterministic_int(pan, 1, 179, "days_ago_cool")
        last_application_date = (datetime.now() - timedelta(days=days_ago)).isoformat()
        
    if "INQ" in pan:
        recent_hard_inquiries = 4
        
    if "FOIR" in pan:
        active_loans_monthly_emi = 60000.0  # high enough to blow past limits

    report = BureauReport(
        pan_number=pan,
        cibil_score=cibil_score,
        active_trade_lines=active_trade_lines,
        historical_defaults=historical_defaults,
        report_date=date.today().isoformat(),
        last_application_date=last_application_date,
        last_application_status=last_application_status,
        recent_hard_inquiries=recent_hard_inquiries,
        active_loans_monthly_emi=active_loans_monthly_emi
    )
    return JSONResponse(report.model_dump())


@router.get("/eligibility/pre-check/{pan_number}")
async def check_eligibility(pan_number: str) -> JSONResponse:
    from app.services.db import get_database, utc_now
    from datetime import timedelta
    
    pan = pan_number.upper().strip()
    db = get_database()
    
    user = await db["users"].find_one({"pan_number": pan})
    
    if user:
        user_id = str(user["_id"])
        now = utc_now()
        
        # Rule 1: Dynamic Excessive Inquiries (Rolling 30-day window)
        # Note: Passes gracefully when a session becomes > 30 days old.
        thirty_days_ago = now - timedelta(days=30)
        recent_sessions_count = await db["sessions"].count_documents({
            "user_id": user_id,
            "created_at": {"$gte": thirty_days_ago}
        })
        
        if recent_sessions_count > 2:
            return JSONResponse(
                status_code=403, 
                content={"eligible": False, "reason": "EXCESSIVE_INQUIRIES"}
            )
            
        # Rule 2: Dynamic Cooling-Off Period (Rolling 180-day window after REJECT)
        # Rejections automatically drop off the radar after exactly 180 days.
        one_eighty_days_ago = now - timedelta(days=180)
        rejected_sessions = await db["sessions"].find({
            "user_id": user_id,
            "created_at": {"$gte": one_eighty_days_ago},
            "$or": [
                {"review_status": "REJECTED"},
                {"final_score.approval_recommendation": "REJECT"}
            ]
        }).sort("created_at", -1).to_list(1)
        
        if rejected_sessions:
            last_rejected = rejected_sessions[0]
            last_date = last_rejected.get("created_at")
            if last_date:
                days_since = (now - last_date).days
                if days_since < 180:
                    return JSONResponse(
                        status_code=403,
                        content={
                            "eligible": False,
                            "reason": "COOLING_OFF_PERIOD",
                            "days_remaining": 180 - days_since
                        }
                    )
                    
    # Success (No dynamic blocks hit)
    return JSONResponse({"eligible": True})
