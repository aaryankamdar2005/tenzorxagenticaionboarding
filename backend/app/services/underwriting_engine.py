"""
Underwriting Engine — implements the 3 Cs (Capacity, Credit, Collateral).
Deterministic rule matrix + dynamic pricing.
"""
from __future__ import annotations

import logging
from typing import Any

from app.models.schemas import KYCExtraction, OfferResult, Status, UnderwritingResult
from app.services.db import get_database, log_event, utc_now

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────
BASE_RATE = 10.0          # % base interest rate
CIBIL_APPROVE_FLOOR = 700
CIBIL_REJECT_CEILING = 600
DTI_APPROVE_CEILING = 40.0
DTI_REJECT_FLOOR = 50.0
INCOME_MISMATCH_THRESHOLD = 0.20   # 20% variance between stated vs OCR income


def _dynamic_rate(cibil: int, dti: float) -> float:
    """Calculate interest rate: base 10%, CIBIL discount, DTI premium."""
    rate = BASE_RATE

    # CIBIL discount: -0.5% per 50 pts above 700
    if cibil > CIBIL_APPROVE_FLOOR:
        extra_pts = cibil - CIBIL_APPROVE_FLOOR
        rate -= (extra_pts // 50) * 0.5

    # DTI premium: +1% per 5% DTI above 30%
    if dti > 30.0:
        extra_dti = dti - 30.0
        rate += (extra_dti / 5.0) * 1.0

    return round(max(rate, 8.0), 2)   # floor at 8%


def _loan_amount(income: float, cibil: int) -> float:
    """Determine sanctioned amount as a multiple of monthly income."""
    if cibil >= 750:
        multiplier = 30   # ~2.5yr income
    elif cibil >= 700:
        multiplier = 24
    elif cibil >= 650:
        multiplier = 18
    else:
        multiplier = 12
    return round(income * multiplier, 2)


def _tenure(cibil: int) -> int:
    if cibil >= 750:
        return 60
    if cibil >= 700:
        return 48
    if cibil >= 650:
        return 36
    return 24


def compute_underwriting(
    kyc: KYCExtraction,
    cibil_score: int,
    historical_defaults: bool,
    active_trade_lines: int,
    verified_income_ocr: float | None,
    active_loans_monthly_emi: float = 0.0,
) -> UnderwritingResult:
    """
    Full 3Cs underwriting decision.
    Returns UnderwritingResult with decision, pricing, and reasons.
    """
    reject_reasons: list[str] = []
    review_reasons: list[str] = []

    stated_income = kyc.income_declaration or 0.0
    monthly_emis = kyc.monthly_emi_obligations or 0.0

    # ── Capacity: DTI Ratio (Self-declared) ───────────────────────────────────
    if stated_income > 0:
        dti_ratio = (monthly_emis / stated_income) * 100
    else:
        dti_ratio = 100.0   # no income = infinite DTI

    # ── FOIR Enforcement ──────────────────────────────────────────────────────
    proposed_new_loan_emi = 5000.0  # Estimated standard EMI for base loan
    total_monthly_debt = active_loans_monthly_emi + proposed_new_loan_emi
    verified_monthly_income = verified_income_ocr if verified_income_ocr else stated_income
    
    if verified_monthly_income > 0:
        foir_ratio = (total_monthly_debt / verified_monthly_income) * 100
    else:
        foir_ratio = 100.0

    # ── Income verification against OCR bank statement ────────────────────────
    if verified_income_ocr and stated_income > 0:
        variance = abs(verified_income_ocr - stated_income) / stated_income
        if variance > INCOME_MISMATCH_THRESHOLD:
            income_status = "MISMATCH"
            review_reasons.append(
                f"Stated income ₹{stated_income:,.0f} differs by "
                f"{variance*100:.1f}% from OCR-verified ₹{verified_income_ocr:,.0f}"
            )
        else:
            income_status = "VERIFIED"
    elif stated_income > 0:
        income_status = "UNVERIFIED"
    else:
        income_status = "MISSING"

    # ── REJECT rules ──────────────────────────────────────────────────────────
    if foir_ratio > 50.0:
        reject_reasons.append(f"FOIR_EXCEEDED: >50% (Calculated FOIR: {foir_ratio:.1f}%)")
    if cibil_score < CIBIL_REJECT_CEILING:
        reject_reasons.append(f"CIBIL score {cibil_score} is below minimum threshold of {CIBIL_REJECT_CEILING}")
    if dti_ratio > DTI_REJECT_FLOOR:
        reject_reasons.append(f"Debt-to-Income ratio {dti_ratio:.1f}% exceeds maximum of {DTI_REJECT_FLOOR}%")
    if historical_defaults:
        reject_reasons.append("Historical loan defaults detected in bureau report")
    if not kyc.explicit_consent:
        reject_reasons.append("Explicit verbal consent not provided")
    if stated_income <= 0:
        reject_reasons.append("Income declaration missing or zero")

    # ── REVIEW rules (only if not already rejected) ──────────────────────────
    if not reject_reasons:
        if income_status == "MISMATCH":
            review_reasons.append("Income mismatch requires manual verification")
        if kyc.stress_flag:
            review_reasons.append("Voice stress indicators detected during interview")
        if cibil_score < CIBIL_APPROVE_FLOOR:
            review_reasons.append(f"CIBIL score {cibil_score} below auto-approve threshold of {CIBIL_APPROVE_FLOOR}")
        if dti_ratio > DTI_APPROVE_CEILING:
            review_reasons.append(f"DTI ratio {dti_ratio:.1f}% above comfortable ceiling of {DTI_APPROVE_CEILING}%")

    # ── Final decision ────────────────────────────────────────────────────────
    if reject_reasons:
        decision = "REJECTED"
        loan_amount = None
        rate = None
        tenure = None
    elif review_reasons:
        decision = "MANUAL_REVIEW"
        # Still show indicative pricing
        rate = _dynamic_rate(cibil_score, dti_ratio)
        loan_amount = _loan_amount(stated_income, cibil_score) if stated_income > 0 else None
        tenure = _tenure(cibil_score)
    else:
        # Full auto-approve
        decision = "APPROVED"
        rate = _dynamic_rate(cibil_score, dti_ratio)
        loan_amount = _loan_amount(stated_income, cibil_score)
        tenure = _tenure(cibil_score)

    pricing_breakdown = {
        "base_rate_pct": BASE_RATE,
        "cibil_discount_pct": round(BASE_RATE - (rate or BASE_RATE), 2) if rate else 0,
        "dti_premium_pct": round((rate or BASE_RATE) - BASE_RATE, 2) if rate else 0,
        "final_rate_pct": rate,
        "cibil_score": cibil_score,
        "dti_ratio_pct": round(dti_ratio, 2),
        "active_trade_lines": active_trade_lines,
        "historical_defaults": historical_defaults,
    }

    logger.info(
        "Underwriting: decision=%s cibil=%d dti=%.1f%% rate=%s amount=%s",
        decision, cibil_score, dti_ratio, rate, loan_amount,
    )

    return UnderwritingResult(
        decision=decision,
        cibil_score=cibil_score,
        dti_ratio=round(dti_ratio, 2),
        income_verification_status=income_status,
        loan_amount=loan_amount,
        interest_rate=rate,
        tenure_months=tenure,
        reject_reasons=reject_reasons,
        review_reasons=review_reasons,
        pricing_breakdown=pricing_breakdown,
    )


def underwriting_to_offer(uw: UnderwritingResult) -> OfferResult:
    """Convert UnderwritingResult → OfferResult for WebSocket emission."""
    status_map = {
        "APPROVED": Status.APPROVED,
        "REJECTED": Status.REJECTED,
        "MANUAL_REVIEW": Status.REVIEW,
    }
    reasons_str = "; ".join(uw.reject_reasons or uw.review_reasons or ["Decision computed"])
    return OfferResult(
        status=status_map.get(uw.decision, Status.REVIEW),
        amount=uw.loan_amount,
        roi=uw.interest_rate,
        tenure_months=uw.tenure_months,
        reason=reasons_str,
        cibil_score=uw.cibil_score,
        dti_ratio=uw.dti_ratio,
        income_verification_status=uw.income_verification_status,
    )


async def run_full_underwriting_and_save(
    session_id: str,
    kyc: KYCExtraction,
    bureau_data: dict[str, Any],
    verified_income_ocr: float | None,
    conversation_snapshot: list[dict],
    ocr_results: dict[str, Any],
) -> tuple[UnderwritingResult, OfferResult]:
    """
    End-to-end underwriting: compute, persist audit log, return results.
    """
    uw = compute_underwriting(
        kyc=kyc,
        cibil_score=bureau_data.get("cibil_score", 500),
        historical_defaults=bureau_data.get("historical_defaults", True),
        active_trade_lines=bureau_data.get("active_trade_lines", 0),
        verified_income_ocr=verified_income_ocr,
        active_loans_monthly_emi=bureau_data.get("active_loans_monthly_emi", 0.0),
    )
    offer = underwriting_to_offer(uw)

    db = get_database()

    # Update session with offer + underwriting detail
    await db["sessions"].update_one(
        {"session_id": session_id},
        {
            "$set": {
                "latest_offer": offer.model_dump(),
                "underwriting_result": uw.model_dump(),
                "bureau_data": bureau_data,
                "state": "UNDERWRITING_COMPLETE",
                "underwriting_at": utc_now(),
            }
        },
    )

    # Full audit log document
    await log_event("audit_logs", {
        "session_id": session_id,
        "event": "UNDERWRITING_COMPLETE",
        "payload": {
            "conversation_snapshot": conversation_snapshot,
            "kyc_fields": kyc.model_dump(),
            "ocr_results": ocr_results,
            "bureau_data": bureau_data,
            "dti_calculation": {
                "stated_income": kyc.income_declaration,
                "monthly_emis": kyc.monthly_emi_obligations,
                "dti_ratio_pct": uw.dti_ratio,
            },
            "underwriting_result": uw.model_dump(),
            "final_offer": offer.model_dump(),
        },
    })

    return uw, offer
