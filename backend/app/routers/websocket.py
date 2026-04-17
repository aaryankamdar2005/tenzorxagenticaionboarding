"""
WebSocket handler — full Phase 2–3 upgrade:
  - Groq Whisper STT (replaces Sarvam)
  - Conversational Llama-3 KYC agent
  - Conversation history tracking per session
  - Handles: age_estimation, recorder_config, manual_transcript,
             liveness_result, geo_data
  - Emits: TRANSCRIPT_UPDATE, AGENT_REPLY, EXTRACTED_FIELDS,
           LIVENESS_ACK, GEO_RESULT, OFFER_READY, FINAL_SCORE, ERROR
"""
from __future__ import annotations

import json
import logging
import time
from collections import defaultdict
from typing import Any

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect

from app.models.schemas import KYCExtraction, WSOutboundEvent
from app.services.db import get_database, log_event, utc_now
from app.services.decision_engine import compute_and_save_final_score
from app.services.geo_service import verify_geo
from app.services.groq_client import TranscriptionError, get_lang_info, run_kyc_agent, transcribe_with_whisper
from app.services.risk_engine import generate_offer

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])

# ── Per-session in-memory state ───────────────────────────────────────────────
_audio_buffers: dict[str, bytearray] = defaultdict(bytearray)
_audio_mime_types: dict[str, str] = defaultdict(lambda: "audio/webm")
_conversation_history: dict[str, list[dict[str, str]]] = defaultdict(list)
_extracted_fields: dict[str, dict[str, Any]] = defaultdict(dict)
_age_scores: dict[str, list[int]] = defaultdict(list)   # stores rounded ints for mode
_liveness_passed: dict[str, bool] = defaultdict(bool)
_geo_mismatch: dict[str, bool] = defaultdict(bool)
# Tracks the last detected Whisper language name (e.g. "hindi") per session
_session_language: dict[str, str] = defaultdict(lambda: "english")

_MIN_AUDIO_BYTES = 1_000


def _mode_age(session_id: str) -> int | None:
    """Returns the most frequently detected age (mode). Falls back to avg if no clear winner."""
    vals = _age_scores.get(session_id, [])
    if not vals:
        return None
    counts: dict[int, int] = {}
    for v in vals:
        counts[v] = counts.get(v, 0) + 1
    return max(counts, key=lambda k: counts[k])


async def _emit(ws: WebSocket, event: WSOutboundEvent) -> None:
    try:
        await ws.send_text(event.model_dump_json())
    except Exception:
        pass


# ── Agent response handler ────────────────────────────────────────────────────

async def _run_agent_turn(ws: WebSocket, session_id: str, user_text: str, detected_language: str = "english") -> None:
    """One conversational turn: user text → agent reply + field extraction."""
    history = _conversation_history[session_id]
    current = _extracted_fields[session_id]

    # Persist detected language for this session
    if detected_language and detected_language != "english":
        _session_language[session_id] = detected_language
    lang_name = _session_language[session_id]
    iso_code, bcp47, lang_label = get_lang_info(lang_name)

    try:
        result = await run_kyc_agent(history, user_text, current, detected_language=lang_name)
    except Exception as exc:
        logger.exception("KYC agent error for session %s: %s", session_id, exc)
        await _emit(ws, WSOutboundEvent(type="ERROR", payload={"message": "Agent processing failed", "details": str(exc)}))
        return

    agent_reply: str = result.get("agent_reply", "")
    extracted: dict = result.get("extracted_fields", {})
    is_complete: bool = bool(result.get("is_complete", False))

    # Update running field state (merge — don't overwrite non-null with null)
    for k, v in extracted.items():
        if v is not None:
            current[k] = v
    current["stress_flag"] = result.get("stress_flag", False)
    current["stress_reasons"] = result.get("stress_reasons", [])
    current["is_complete"] = is_complete

    # Append to conversation history
    history.append({"role": "user", "content": user_text})
    if agent_reply:
        history.append({"role": "assistant", "content": agent_reply})

    # ── Emit events to frontend ───────────────────────────────────────────────
    await _emit(ws, WSOutboundEvent(type="TRANSCRIPT_UPDATE", payload={"text": user_text}))

    if agent_reply:
        await _emit(ws, WSOutboundEvent(type="AGENT_REPLY", payload={
            "text": agent_reply,
            "lang": lang_name,         # e.g. "hindi"
            "bcp47": bcp47,            # e.g. "hi-IN"  → used by browser TTS
            "lang_label": lang_label,  # e.g. "हिन्दी (Hindi)"
        }))

    await _emit(ws, WSOutboundEvent(type="EXTRACTED_FIELDS", payload=current))

    if current.get("explicit_consent"):
        await _emit(ws, WSOutboundEvent(type="CONSENT_DETECTED", payload={"consent": True}))

    # ── Persist transcript ────────────────────────────────────────────────────
    await log_event("transcripts", {"session_id": session_id, "user": user_text, "agent": agent_reply})

    # ── If complete, generate offer and trigger final scoring ─────────────────
    if is_complete:
        kyc = KYCExtraction(
            full_name=current.get("full_name"),
            dob=current.get("dob"),
            employer=current.get("employer"),
            employment_details=current.get("employer"),
            income_declaration=current.get("income_declaration"),
            loan_purpose=current.get("loan_purpose"),
            explicit_consent=bool(current.get("explicit_consent", False)),
            stress_flag=bool(current.get("stress_flag", False)),
        )

        await _emit(ws, WSOutboundEvent(type="PROCESSING_OFFER", payload={}))
        offer = generate_offer(_avg_age(session_id), kyc)

        db = get_database()
        await db["sessions"].update_one(
            {"session_id": session_id},
            {
                "$set": {
                    "latest_extraction": current,
                    "latest_offer": offer.model_dump(),
                    "best_age_estimate": _mode_age(session_id),
                    "conversation_history": _conversation_history[session_id],
                    "state": "INTERVIEW_COMPLETE",
                    "completed_at": utc_now(),
                }
            },
        )

        await _emit(ws, WSOutboundEvent(type="OFFER_READY", payload=offer.model_dump()))

        # Final AI scoring (async — don't block)
        try:
            final = await compute_and_save_final_score(session_id)
            await _emit(ws, WSOutboundEvent(type="FINAL_SCORE", payload=final.model_dump()))
        except Exception as exc:
            logger.warning("Final scoring failed: %s", exc)


# ── Audio processing ──────────────────────────────────────────────────────────

async def _process_audio(ws: WebSocket, session_id: str) -> None:
    audio_data = bytes(_audio_buffers[session_id])
    if len(audio_data) < _MIN_AUDIO_BYTES:
        return

    detected_language = "english"
    try:
        result = await transcribe_with_whisper(audio_data, _audio_mime_types[session_id])
        if result is None:
            return
        transcript, detected_language = result
    except TranscriptionError as exc:
        await _emit(ws, WSOutboundEvent(type="ERROR", payload={"message": "STT failed", "details": str(exc)}))
        return
    finally:
        _audio_buffers[session_id].clear()

    if not transcript:
        return

    # Filter Whisper hallucinations (common in multilingual mode)
    lower = transcript.lower().strip()
    hallucinations = {"thank you.", "thank you", "thanks for watching", "please subscribe", "bye.", "amara.org", "धन्यवाद"}
    if lower in hallucinations and len(lower) < 30:
        return

    await _run_agent_turn(ws, session_id, transcript.strip(), detected_language)


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@router.websocket("/ws/{session_id}")
async def onboarding_socket(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()

    # Inject initial agent greeting
    client_ip = websocket.client.host if websocket.client else "unknown"
    logger.info("WS connected: session=%s ip=%s", session_id, client_ip)

    await _emit(websocket, WSOutboundEvent(type="CONNECTED", payload={"session_id": session_id}))

    # Send initial greeting as AGENT_REPLY so frontend speaks it
    greeting = (
        "Welcome to SecureBank! I'm Aria, your AI loan officer. "
        "This is a secure video KYC session. To get started, could you please tell me your full name?"
    )
    await _emit(websocket, WSOutboundEvent(type="AGENT_REPLY", payload={"text": greeting}))
    _conversation_history[session_id].append({"role": "assistant", "content": greeting})

    try:
        while True:
            message = await websocket.receive()

            # ── Binary audio chunk ────────────────────────────────────────────
            if "bytes" in message and message["bytes"]:
                _audio_buffers[session_id].extend(message["bytes"])
                await _process_audio(websocket, session_id)
                continue

            # ── JSON control messages ─────────────────────────────────────────
            text_data = message.get("text")
            if not text_data:
                continue

            try:
                parsed: dict[str, Any] = json.loads(text_data)
            except json.JSONDecodeError:
                continue

            kind = parsed.get("kind", "")

            if kind == "recorder_config":
                mime = parsed.get("mime_type")
                if isinstance(mime, str) and mime:
                    _audio_mime_types[session_id] = mime

            elif kind == "set_language":
                # Manual override from the language switcher buttons
                lang_name = str(parsed.get("language", "english")).lower()
                valid_langs = {"english", "hindi", "marathi", "punjabi", "kannada", "tulu",
                               "bengali", "tamil", "telugu", "gujarati"}
                if lang_name in valid_langs:
                    _session_language[session_id] = lang_name
                    _, bcp47, label = get_lang_info(lang_name)
                    logger.info("Language manually switched to %s for session %s", lang_name, session_id)
                    # Ask Aria to acknowledge the switch in the new language
                    ack_prompt = (
                        f"The user has just switched to {lang_name}. "
                        f"Briefly acknowledge this in {lang_name} (one sentence) "
                        f"and invite them to continue the KYC interview in {lang_name}."
                    )
                    await _run_agent_turn(websocket, session_id, ack_prompt, lang_name)


            elif kind == "age_estimation":
                age = parsed.get("age_estimation_score")
                if isinstance(age, (int, float)):
                    scores = _age_scores[session_id]
                    scores.append(int(round(float(age))))
                    _age_scores[session_id] = scores[-30:]  # keep last 30 readings
                    # Update best (mode) age in DB every 5 estimates
                    if len(scores) % 5 == 0:
                        db = get_database()
                        await db["sessions"].update_one(
                            {"session_id": session_id},
                            {"$set": {"best_age_estimate": _mode_age(session_id)}},
                        )

            elif kind == "manual_transcript":
                text = parsed.get("text", "").strip()
                if text:
                    await _run_agent_turn(websocket, session_id, text)

            elif kind == "liveness_result":
                passed = bool(parsed.get("passed", False))
                challenge = str(parsed.get("challenge", ""))
                attempts = int(parsed.get("attempts", 0))
                _liveness_passed[session_id] = passed

                liveness_doc = {
                    "challenge": challenge,
                    "passed": passed,
                    "biometric_passed": passed,
                    "attempts": attempts,
                    "timestamp": time.time(),
                }

                db = get_database()
                await db["sessions"].update_one(
                    {"session_id": session_id},
                    {"$set": {
                        "liveness_result": liveness_doc,
                        "biometric_passed": passed,
                    }},
                )
                await log_event("audit_logs", {
                    "session_id": session_id,
                    "event": "LIVENESS_RESULT",
                    "payload": liveness_doc,
                })
                await _emit(websocket, WSOutboundEvent(type="LIVENESS_ACK", payload=liveness_doc))

                if not passed and attempts >= 3:
                    await _emit(websocket, WSOutboundEvent(
                        type="SESSION_FAILED",
                        payload={"reason": "Liveness verification failed after 3 attempts"},
                    ))

            elif kind == "geo_data":
                gps_lat = parsed.get("lat")
                gps_lng = parsed.get("lng")
                try:
                    geo_result = await verify_geo(client_ip, gps_lat, gps_lng)
                    _geo_mismatch[session_id] = geo_result.is_mismatch

                    db = get_database()
                    await db["sessions"].update_one(
                        {"session_id": session_id},
                        {"$set": {"geo_result": geo_result.model_dump()}},
                    )
                    await _emit(websocket, WSOutboundEvent(
                        type="GEO_RESULT",
                        payload=geo_result.model_dump(),
                    ))
                except Exception as exc:
                    logger.warning("Geo verification error: %s", exc)

    except WebSocketDisconnect:
        pass
    except RuntimeError as exc:
        if "disconnect" not in str(exc).lower():
            logger.exception("WS runtime error: %s", exc)
    finally:
        await log_event("audit_logs", {
            "session_id": session_id,
            "event": "WS_DISCONNECTED",
            "payload": {"best_age": _mode_age(session_id)},
        })
        logger.info("WS disconnected: session=%s", session_id)
