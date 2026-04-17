from __future__ import annotations

from app.models.schemas import KYCExtraction, OfferResult, Status


def _mock_bureau_score(income: float | None) -> int:
    if income is None:
        return 480
    if income >= 80000:
        return 760
    if income >= 45000:
        return 680
    if income >= 25000:
        return 610
    return 520


def generate_offer(detected_age: float | None, extraction: KYCExtraction) -> OfferResult:
    if detected_age is not None and detected_age < 18:
        return OfferResult(status=Status.REJECTED, reason="Applicant under legal age")

    if extraction.explicit_consent is False:
        return OfferResult(status=Status.REJECTED, reason="Explicit verbal consent not detected")

    bureau = _mock_bureau_score(extraction.income_declaration)

    if extraction.income_declaration is None:
        return OfferResult(status=Status.REVIEW, reason="Income declaration missing")

    multiplier = 2.2 if bureau >= 700 else 1.4 if bureau >= 620 else 0.8
    amount = max(10000, extraction.income_declaration * multiplier)

    if bureau >= 700:
        roi = 11.5
        tenure = 36
        status = Status.APPROVED
    elif bureau >= 620:
        roi = 14.0
        tenure = 24
        status = Status.APPROVED
    else:
        roi = 18.5
        tenure = 12
        status = Status.REVIEW

    return OfferResult(
        status=status,
        amount=round(amount, 2),
        roi=roi,
        tenure_months=tenure,
        reason=f"Decision based on income and mocked bureau score {bureau}",
    )
