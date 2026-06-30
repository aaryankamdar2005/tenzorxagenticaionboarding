"""
Advanced document extraction endpoint.
POST /api/extract-document
  - Accepts image + document_type (pan / aadhaar / bank_statement / payslip)
  - Runs EasyOCR → raw text
  - Passes raw text into Llama-3 for structured extraction
  - Returns clean structured JSON
"""
from __future__ import annotations

import io
import logging
import re
from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from rapidfuzz import fuzz

from app.services.db import get_database, utc_now
from app.services.groq_client import extract_document_fields

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["documents"])



# ── Fuzzy matching helper ─────────────────────────────────────────────────────

def _fuzzy(a: str | None, b: str | None) -> float:
    if not a or not b:
        return 0.0
    scores = [
        fuzz.token_sort_ratio(a.lower(), b.lower()),
        fuzz.token_set_ratio(a.lower(), b.lower()),
        fuzz.partial_ratio(a.lower(), b.lower()),
    ]
    return float(max(scores))


# ── /api/extract-document ─────────────────────────────────────────────────────

@router.post("/extract-document")
async def extract_document(
    file: UploadFile,
    session_id: Annotated[str, Form()],
    document_type: Annotated[str, Form()],               # pan | aadhaar | bank_statement | payslip
    spoken_name: Annotated[str | None, Form()] = None,
    spoken_dob: Annotated[str | None, Form()] = None,
) -> JSONResponse:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Upload must be an image file")

    image_bytes = await file.read()
    if len(image_bytes) < 1000:
        raise HTTPException(400, "Image too small — please recapture")

    doc_type = document_type.lower().strip()
    if doc_type not in ("pan", "aadhaar", "bank_statement", "payslip"):
        raise HTTPException(400, "document_type must be: pan | aadhaar | bank_statement | payslip")

    # Step 1: LLM-powered structured extraction via Groq Vision API
    extracted = await extract_document_fields(image_bytes, doc_type)
    if not extracted:
        return JSONResponse({
            "document_type": doc_type,
            "extracted": {},
            "match_score": 0.0,
            "is_match": False,
            "error": "Document extraction failed.",
        })
    logger.info("LLM extracted fields: %s", extracted)

    # Step 3: Fuzzy matching for identity docs
    match_score = 0.0
    is_match = False
    if doc_type in ("pan", "aadhaar"):
        name_score = _fuzzy(extracted.get("name"), spoken_name)
        dob_score = _fuzzy(extracted.get("dob"), spoken_dob)
        if spoken_name and spoken_dob:
            match_score = name_score * 0.6 + dob_score * 0.4
        elif spoken_name:
            match_score = name_score
        elif spoken_dob:
            match_score = dob_score
        is_match = match_score >= 60.0

    result = {
        "document_type": doc_type,
        "extracted": extracted,
        "match_score": round(match_score, 1),
        "is_match": is_match,
    }

    # Persist to session
    try:
        db = get_database()
        field_key = f"ocr_{doc_type}"
        await db["sessions"].update_one(
            {"session_id": session_id},
            {"$set": {field_key: {**result, "captured_at": utc_now()}}},
        )
    except Exception as exc:
        logger.warning("Could not persist doc result: %s", exc)

    return JSONResponse(result)


# ── /api/verify-document (backward compat — simple identity check) ────────────

@router.post("/verify-document")
async def verify_document(
    file: UploadFile,
    session_id: Annotated[str, Form()],
    spoken_name: Annotated[str | None, Form()] = None,
    spoken_dob: Annotated[str | None, Form()] = None,
) -> JSONResponse:
    """Legacy endpoint — proxies to extract-document as PAN/Aadhaar."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Upload must be an image file")

    image_bytes = await file.read()
    if len(image_bytes) < 1000:
        raise HTTPException(400, "Image too small")

    extracted = await extract_document_fields(image_bytes, "pan")
    if not extracted:
        return JSONResponse({
            "ocr_name": None, "ocr_dob": None,
            "match_score": 0.0, "is_match": False,
            "error": "Document extraction failed",
        })

    ocr_name = extracted.get("name")
    ocr_dob = extracted.get("dob")

    name_score = _fuzzy(ocr_name, spoken_name)
    dob_score = _fuzzy(ocr_dob, spoken_dob)
    if spoken_name and spoken_dob:
        match_score = name_score * 0.6 + dob_score * 0.4
    elif spoken_name:
        match_score = name_score
    elif spoken_dob:
        match_score = dob_score
    else:
        match_score = 0.0

    result = {
        "ocr_name": ocr_name,
        "ocr_dob": ocr_dob,
        "match_score": round(match_score, 1),
        "is_match": match_score >= 60.0,
    }

    try:
        db = get_database()
        await db["sessions"].update_one(
            {"session_id": session_id},
            {"$set": {"document_verification": {**result, "verified_at": utc_now()}}},
        )
    except Exception as exc:
        logger.warning("Could not persist: %s", exc)

    return JSONResponse(result)
