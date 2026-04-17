"""
Mock Credit Bureau — deterministic CIBIL report from PAN number.
GET /api/bureau/credit-report/{pan_number}
"""
from __future__ import annotations

import hashlib
from datetime import date

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
    # Defaults flag: true only for very low scores (≤ 450) deterministically
    default_flag_val = _deterministic_int(pan, 0, 99, "defaults")
    historical_defaults = cibil_score <= 450 or default_flag_val < 15

    report = BureauReport(
        pan_number=pan,
        cibil_score=cibil_score,
        active_trade_lines=active_trade_lines,
        historical_defaults=historical_defaults,
        report_date=date.today().isoformat(),
    )
    return JSONResponse(report.model_dump())
