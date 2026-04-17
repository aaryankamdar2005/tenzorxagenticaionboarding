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


# ── OCR Engines ───────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _get_easyocr_reader():
    try:
        import easyocr  # type: ignore
        logger.info("Initialising EasyOCR reader…")
        reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        logger.info("EasyOCR ready.")
        return reader
    except ImportError:
        logger.warning("easyocr not installed")
        return None
    except Exception as exc:
        logger.warning("EasyOCR init failed: %s", exc)
        return None


def _preprocess(image_bytes: bytes):
    from PIL import Image, ImageEnhance, ImageFilter  # type: ignore
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    w, h = img.size
    if w < 1800:
        scale = 1800 / w
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    img = img.filter(ImageFilter.SHARPEN)
    img = ImageEnhance.Contrast(img).enhance(2.2)
    img = ImageEnhance.Sharpness(img).enhance(2.5)
    return img


def _run_easyocr(image_bytes: bytes) -> str:
    reader = _get_easyocr_reader()
    if reader is None:
        return ""
    try:
        import numpy as np  # type: ignore
        img = _preprocess(image_bytes)
        img_np = np.array(img)
        results = reader.readtext(img_np, detail=0, paragraph=False)
        text = "\n".join(str(r) for r in results)
        logger.info("EasyOCR extracted %d chars", len(text))
        return text
    except Exception as exc:
        logger.warning("EasyOCR failed: %s", exc)
        return ""


def _run_tesseract(image_bytes: bytes) -> str:
    try:
        import pytesseract  # type: ignore
        from PIL import ImageOps  # type: ignore
        img = _preprocess(image_bytes)
        grey = ImageOps.grayscale(img)
        binary = grey.point(lambda x: 0 if x < 140 else 255, "1").convert("L")
        t1 = pytesseract.image_to_string(binary, lang="eng", config="--psm 6 --oem 3").strip()
        t2 = pytesseract.image_to_string(grey, lang="eng", config="--psm 6 --oem 3").strip()
        return max([t1, t2], key=len)
    except Exception as exc:
        if "TesseractNotFound" in type(exc).__name__:
            logger.warning("Tesseract binary not found — skipping")
        else:
            logger.warning("Tesseract failed: %s", exc)
        return ""


def _run_ocr(image_bytes: bytes) -> str:
    text = _run_easyocr(image_bytes)
    if not text:
        text = _run_tesseract(image_bytes)
    return text


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

    # Step 1: OCR
    ocr_text = _run_ocr(image_bytes)
    if not ocr_text:
        return JSONResponse({
            "document_type": doc_type,
            "ocr_raw_text": None,
            "extracted": {},
            "match_score": 0.0,
            "is_match": False,
            "error": "OCR engine unavailable. Install easyocr: pip install easyocr",
        })

    logger.info("OCR [%s] extracted %d chars", doc_type, len(ocr_text))

    # Step 2: LLM-powered structured extraction
    extracted = await extract_document_fields(ocr_text, doc_type)
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
        "ocr_raw_text": ocr_text[:800],
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

    ocr_text = _run_ocr(image_bytes)
    if not ocr_text:
        return JSONResponse({
            "ocr_name": None, "ocr_dob": None, "ocr_raw_text": None,
            "match_score": 0.0, "is_match": False,
            "error": "OCR engine unavailable",
        })

    extracted = await extract_document_fields(ocr_text, "pan")

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
        "ocr_raw_text": ocr_text[:800],
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
