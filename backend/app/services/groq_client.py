"""
Groq client: Whisper STT + conversational KYC agent (Llama-3 with 3Cs) + final AI scoring.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any

import httpx

from app.models.schemas import AuditScore, KYCExtraction

GROQ_API_BASE = "https://api.groq.com/openai/v1"
logger = logging.getLogger(__name__)


class TranscriptionError(RuntimeError):
    pass


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {os.getenv('GROQ_API_KEY', '')}",
        "Content-Type": "application/json",
    }


# ── Language support map ──────────────────────────────────────────────────────
_LANG_MAP: dict[str, tuple[str, str, str]] = {
    "english":  ("en", "en-US", "English"),
    "hindi":    ("hi", "hi-IN", "हिन्दी (Hindi)"),
    "marathi":  ("mr", "mr-IN", "मराठी (Marathi)"),
    "punjabi":  ("pa", "pa-IN", "ਪੰਜਾਬੀ (Punjabi)"),
    "kannada":  ("kn", "kn-IN", "ಕನ್ನಡ/ತುಳು (Kannada/Tulu)"),
    "tulu":     ("kn", "kn-IN", "ತುಳು (Tulu)"),
    "bengali":  ("bn", "bn-IN", "বাংলা (Bengali)"),
    "tamil":    ("ta", "ta-IN", "தமிழ் (Tamil)"),
    "telugu":   ("te", "te-IN", "తెలుగు (Telugu)"),
    "gujarati": ("gu", "gu-IN", "ગુજરાતી (Gujarati)"),
}


def get_lang_info(whisper_lang: str) -> tuple[str, str, str]:
    return _LANG_MAP.get(whisper_lang.lower(), ("en", "en-US", "English"))


# ── Whisper STT ────────────────────────────────────────────────────────────────

async def transcribe_with_whisper(
    audio_bytes: bytes,
    mime_type: str = "audio/webm",
) -> tuple[str, str] | None:
    if not os.getenv("GROQ_API_KEY"):
        return None

    mime_type = (mime_type or "audio/webm").lower().split(";")[0]
    ext_map = {"mp4": "mp4", "ogg": "ogg", "wav": "wav", "mpeg": "mp3", "mp3": "mp3", "flac": "flac"}
    extension = next((v for k, v in ext_map.items() if k in mime_type), "webm")

    data = {"model": "whisper-large-v3-turbo", "response_format": "verbose_json"}
    files = {"file": (f"audio.{extension}", audio_bytes, mime_type)}

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(
                f"{GROQ_API_BASE}/audio/transcriptions",
                headers={"Authorization": f"Bearer {os.getenv('GROQ_API_KEY', '')}"},
                data=data,
                files=files,
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            msg = exc.response.text[:500] if exc.response.text else str(exc)
            raise TranscriptionError(msg) from exc
        except httpx.HTTPError as exc:
            raise TranscriptionError(str(exc)) from exc

        payload = resp.json()
        text = payload.get("text", "")
        detected_lang = payload.get("language", "english")
        logger.info("Whisper detected language: %s | text: %s", detected_lang, text[:60])
        return text, detected_lang


# ── Conversational KYC Agent — EXPANDED with 3 Cs ─────────────────────────────

_AGENT_SYSTEM = """\
You are Aria, a warm and professional AI loan officer at SecureBank conducting a video KYC interview.

Your goal is to collect ALL of the following information, ONE field at a time, in a natural conversation:

BASIC KYC (collect first):
1. full_name            — Customer's full legal name
2. dob                  — Date of birth (DD/MM/YYYY)
3. employer             — Employer or business name
4. income_declaration   — Gross monthly income in INR (number only)
5. loan_purpose         — Purpose and desired loan amount

THE 3 Cs — CAPACITY (collect after basic KYC):
6. monthly_emi_obligations — "What is the total amount of EMIs or loan repayments you currently pay every month?"
7. tenure_at_employer      — "How long have you been working with your current employer?"
8. property_ownership      — "Do you live in a rented property or do you own your home?"

CONSENT (always last):
9. explicit_consent — Verbal agreement to terms and data processing

RULES:
- LANGUAGE: Reply in the SAME language the user spoke. Devanagari for Hindi/Marathi, Gurmukhi for Punjabi.
- Ask ONLY ONE question per response. Never ask two questions at once.
- If an answer is vague, ask ONE clarifying follow-up.
- Be warm, concise (under 3 sentences), professional.
- Count filler words ("um", "uh", "err", "acha", "matlab", "arre"): if 3+ detected, set stress_flag=true.
- When ALL 9 fields are collected AND consent is given, set is_complete=true.

You MUST respond in this EXACT JSON format — no markdown, no extra keys:
{
  "agent_reply": "<your spoken response in the user's language>",
  "extracted_fields": {
    "full_name": "<string or null>",
    "dob": "<string or null>",
    "employer": "<string or null>",
    "income_declaration": <number or null>,
    "loan_purpose": "<string or null>",
    "monthly_emi_obligations": <number or null>,
    "tenure_at_employer": "<string or null>",
    "property_ownership": "<rented|owned|null>",
    "explicit_consent": <boolean>
  },
  "stress_flag": <boolean>,
  "stress_reasons": ["<reason if any>"],
  "is_complete": <boolean>,
  "next_field_needed": "<field name or null if complete>"
}"""


async def run_kyc_agent(
    conversation_history: list[dict[str, str]],
    new_transcript: str,
    current_fields: dict[str, Any],
    detected_language: str = "english",
) -> dict[str, Any]:
    if not os.getenv("GROQ_API_KEY"):
        return {
            "agent_reply": "Hello! I'm Aria, your SecureBank loan officer. Could you please tell me your full name?",
            "extracted_fields": {k: None for k in [
                "full_name", "dob", "employer", "income_declaration",
                "loan_purpose", "monthly_emi_obligations", "tenure_at_employer",
                "property_ownership",
            ]},
            "stress_flag": False,
            "stress_reasons": [],
            "is_complete": False,
            "next_field_needed": "full_name",
        }

    lang_instruction = (
        f"\n\nDETECTED LANGUAGE: The user is speaking {detected_language.title()}. "
        f"You MUST reply entirely in {detected_language.title()}. "
        f"Use native script (Devanagari for Hindi/Marathi, Gurmukhi for Punjabi)."
    )

    fields_summary = json.dumps(current_fields, indent=2)
    system_prompt = _AGENT_SYSTEM + lang_instruction + f"\n\nCurrently extracted fields:\n{fields_summary}"

    messages = [
        {"role": "system", "content": system_prompt},
        *conversation_history[-14:],
        {"role": "user", "content": new_transcript},
    ]

    body: dict[str, Any] = {
        "model": "llama-3.3-70b-versatile",
        "temperature": 0.35,
        "messages": messages,
        "response_format": {"type": "json_object"},
        "max_tokens": 600,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{GROQ_API_BASE}/chat/completions",
            headers=_headers(),
            json=body,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        return json.loads(content)


# ── Document OCR + LLM Parsing ────────────────────────────────────────────────

async def extract_document_fields(
    ocr_raw_text: str,
    document_type: str,
) -> dict[str, Any]:
    """
    Pass messy OCR text into Llama-3 to extract clean structured data.
    document_type: 'pan', 'aadhaar', 'bank_statement', 'payslip'
    """
    if not os.getenv("GROQ_API_KEY") or not ocr_raw_text.strip():
        return {}

    if document_type in ("pan", "aadhaar"):
        output_spec = """\
{
  "name": "<full legal name or null>",
  "dob": "<DD/MM/YYYY or null>",
  "id_number": "<PAN/Aadhaar number or null>"
}"""
        task = (
            f"Extract the following fields from this {document_type.upper()} card OCR text. "
            "Return ONLY the JSON object, no markdown."
        )
    else:  # bank_statement or payslip
        output_spec = """\
{
  "verified_monthly_income": <float in INR or null>,
  "account_holder_name": "<name or null>",
  "bank_name": "<bank name or null>",
  "income_source": "<employer/salary/business or null>"
}"""
        task = (
            "Analyze this bank statement / payslip OCR text. "
            "Look specifically for salary credits or monthly income transfers. "
            "Return the average or most recent monthly income amount. "
            "Return ONLY the JSON object, no markdown."
        )

    prompt = f"{task}\n\nOutput format:\n{output_spec}\n\nOCR TEXT:\n{ocr_raw_text[:3000]}"

    body = {
        "model": "llama-3.3-70b-versatile",
        "temperature": 0,
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"},
        "max_tokens": 256,
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{GROQ_API_BASE}/chat/completions",
                headers=_headers(),
                json=body,
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return json.loads(content)
    except Exception as exc:
        logger.warning("LLM document extraction failed: %s", exc)
        return {}


# ── Final AI Decision Score ────────────────────────────────────────────────────

async def generate_final_score(
    kyc_fields: dict[str, Any],
    avg_age: float | None,
    liveness_passed: bool,
    ocr_match_score: float,
    geo_mismatch: bool,
    stress_flag: bool,
) -> AuditScore:
    if not os.getenv("GROQ_API_KEY"):
        return AuditScore(
            confidence_score=50,
            approval_recommendation="MANUAL_REVIEW",
            reasons=["Groq API key not configured — defaulting to manual review"],
        )

    context = f"""
KYC Interview Responses:
  - Full Name: {kyc_fields.get('full_name') or 'NOT PROVIDED'}
  - Date of Birth: {kyc_fields.get('dob') or 'NOT PROVIDED'}
  - Employer: {kyc_fields.get('employer') or 'NOT PROVIDED'}
  - Tenure at Employer: {kyc_fields.get('tenure_at_employer') or 'NOT PROVIDED'}
  - Monthly Income (INR): {kyc_fields.get('income_declaration') or 'NOT PROVIDED'}
  - Monthly EMI Obligations (INR): {kyc_fields.get('monthly_emi_obligations') or 'NOT PROVIDED'}
  - Property Ownership: {kyc_fields.get('property_ownership') or 'NOT PROVIDED'}
  - Loan Purpose: {kyc_fields.get('loan_purpose') or 'NOT PROVIDED'}
  - Verbal Consent Given: {kyc_fields.get('explicit_consent', False)}

Automated Fraud Signals:
  - Estimated Age (face-api): {f'{avg_age:.0f} years' if avg_age else 'Not detected'}
  - Liveness Challenge: {'PASSED' if liveness_passed else 'FAILED / NOT COMPLETED'}
  - Document OCR Match Score: {ocr_match_score:.0f}/100
  - GPS vs IP Geo Mismatch (VPN risk): {'YES — HIGH RISK' if geo_mismatch else 'No mismatch detected'}
  - Voice Stress / Hesitation: {'Detected' if stress_flag else 'None detected'}
""".strip()

    prompt = (
        "You are a senior loan underwriting AI at SecureBank. Analyze the KYC data and fraud signals below.\n"
        "Determine: confidence_score (0-100), approval_recommendation (APPROVE/REJECT/MANUAL_REVIEW), and reasons.\n\n"
        "Decision guidelines:\n"
        "  APPROVE        → score ≥ 75, all KYC fields present, liveness passed, low fraud signals\n"
        "  REJECT         → income missing, no consent, liveness failed, geo mismatch >500km, underage\n"
        "  MANUAL_REVIEW  → borderline cases, partial data, moderate fraud signals\n\n"
        'Respond ONLY in this JSON format:\n'
        '{"confidence_score": <int>, "approval_recommendation": "<str>", "reasons": ["<str>", ...]}\n\n'
        f"{context}"
    )

    body = {
        "model": "llama-3.3-70b-versatile",
        "temperature": 0,
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"},
        "max_tokens": 300,
    }

    print(f"=== [AI SCORING] Sending prompt to Groq. Context snippet: {context[:100]}... ===")
    
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(
                f"{GROQ_API_BASE}/chat/completions",
                headers=_headers(),
                json=body,
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            print(f"=== [AI SCORING] Raw Response from Groq: {content} ===")
            return AuditScore.model_validate(json.loads(content))
        except Exception as e:
            print(f"=== [AI SCORING] ERROR calling Groq: {e} ===")
            return AuditScore(
                confidence_score=0,
                approval_recommendation="MANUAL_REVIEW",
                reasons=[f"Error calling LLM: {str(e)}"],
            )


# ── Legacy alias ──────────────────────────────────────────────────────────────
async def extract_kyc_json(conversation_buffer: str) -> KYCExtraction:
    result = await run_kyc_agent([], conversation_buffer, {})
    fields = result.get("extracted_fields", {})
    return KYCExtraction(
        full_name=fields.get("full_name"),
        dob=fields.get("dob"),
        employer=fields.get("employer"),
        employment_details=fields.get("employer"),
        income_declaration=fields.get("income_declaration"),
        monthly_emi_obligations=fields.get("monthly_emi_obligations"),
        tenure_at_employer=fields.get("tenure_at_employer"),
        property_ownership=fields.get("property_ownership"),
        loan_purpose=fields.get("loan_purpose"),
        explicit_consent=bool(fields.get("explicit_consent", False)),
        stress_flag=result.get("stress_flag", False),
        stress_reasons=result.get("stress_reasons", []),
        is_complete=result.get("is_complete", False),
        next_field_needed=result.get("next_field_needed"),
    )
