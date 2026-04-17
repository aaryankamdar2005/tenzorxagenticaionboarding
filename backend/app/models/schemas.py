from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class Status(str, Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    REVIEW = "REVIEW"


class SessionCreateRequest(BaseModel):
    source: str | None = Field(default="landing_page")


class SessionResponse(BaseModel):
    session_id: str


class KYCExtraction(BaseModel):
    full_name: str | None = None
    dob: str | None = None
    employer: str | None = None
    employment_details: str | None = None          # backward-compat alias
    tenure_at_employer: str | None = None          # NEW — how long at employer
    income_declaration: float | None = None
    monthly_emi_obligations: float | None = None   # NEW — existing EMI burden
    property_ownership: str | None = None          # NEW — owned / rented
    loan_purpose: str | None = None
    explicit_consent: bool = False
    stress_flag: bool = False
    stress_reasons: list[str] = Field(default_factory=list)
    is_complete: bool = False
    next_field_needed: str | None = None


class OfferResult(BaseModel):
    status: Status
    amount: float | None = None
    roi: float | None = None
    tenure_months: int | None = None
    reason: str | None = None
    # Underwriting detail
    cibil_score: int | None = None
    dti_ratio: float | None = None
    income_verification_status: str | None = None  # VERIFIED / MISMATCH / UNVERIFIED


class LivenessResult(BaseModel):
    challenge: str
    passed: bool
    attempts: int
    timestamp: float


class DocumentVerification(BaseModel):
    ocr_name: str | None = None
    ocr_dob: str | None = None
    ocr_id_number: str | None = None
    ocr_raw_text: str | None = None
    match_score: float = 0.0
    is_match: bool = False
    verified_monthly_income: float | None = None   # from bank statement OCR


class GeoVerification(BaseModel):
    gps_lat: float | None = None
    gps_lng: float | None = None
    ip_lat: float | None = None
    ip_lng: float | None = None
    distance_km: float | None = None
    is_mismatch: bool = False
    ip_address: str | None = None


class AuditScore(BaseModel):
    confidence_score: int  # 0-100
    approval_recommendation: str  # APPROVE | REJECT | MANUAL_REVIEW
    reasons: list[str]


class WSOutboundEvent(BaseModel):
    type: str
    payload: dict[str, Any] | None = None


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserRole(str, Enum):
    CUSTOMER = "customer"
    BANKER = "banker"


class UserRegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: UserRole = UserRole.CUSTOMER


class UserLoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    name: str
    user_id: str


# ── Credit Bureau Mock ────────────────────────────────────────────────────────

class BureauReport(BaseModel):
    pan_number: str
    cibil_score: int
    active_trade_lines: int
    historical_defaults: bool
    report_date: str


# ── Underwriting ──────────────────────────────────────────────────────────────

class UnderwritingResult(BaseModel):
    decision: str               # APPROVED | REJECTED | MANUAL_REVIEW
    cibil_score: int
    dti_ratio: float
    income_verification_status: str
    loan_amount: float | None
    interest_rate: float | None
    tenure_months: int | None
    reject_reasons: list[str]
    review_reasons: list[str]
    pricing_breakdown: dict[str, Any]
