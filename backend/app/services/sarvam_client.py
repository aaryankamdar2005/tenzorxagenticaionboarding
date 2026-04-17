from __future__ import annotations

import logging
import os
import httpx

logger = logging.getLogger(__name__)

class TranscriptionError(RuntimeError):
    pass

async def transcribe_with_sarvam(audio_bytes: bytes, mime_type: str = "audio/webm") -> str | None:
    api_key = os.getenv("SARVAM_API_KEY")
    if not api_key:
        logger.warning("Missing SARVAM_API_KEY")
        return None

    mime_type = mime_type.lower().split(";")[0] if mime_type else "audio/webm"
    extension = "webm"
    if "mp4" in mime_type:
        extension = "mp4"
    elif "ogg" in mime_type:
        extension = "ogg"
    elif "wav" in mime_type:
        extension = "wav"

    files = {"file": (f"audio.{extension}", audio_bytes, mime_type)}
    # Use standard STT translate fallback model
    data = {"prompt": "","model": "saaras:v3"} # the url provides implicit mode

    async with httpx.AsyncClient(timeout=45) as client:
        try:
            response = await client.post(
                "https://api.sarvam.ai/speech-to-text",
                headers={"api-subscription-key": api_key},
                data=data,
                files=files,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            message = exc.response.text[:500] if exc.response.text else str(exc)
            logger.warning("Sarvam STT failed: %s", message)
            raise TranscriptionError(message) from exc
        except httpx.HTTPError as exc:
            raise TranscriptionError(str(exc)) from exc

        parsed = response.json()
        # Accommodate potential keys
        return parsed.get("transcript") or parsed.get("text") or parsed.get("translated_text")

async def generate_tts_sarvam(text: str) -> str | None:
    api_key = os.getenv("SARVAM_API_KEY")
    if not api_key:
        return None

    payload = {
        "inputs": [text],
        "target_language_code": "en-IN",
        "speaker": "arvind", # generic male/female speaker
        "pitch": 0,
        "pace": 1.0,
        "loudness": 1.0,
        "speech_sample_rate": 8000,
        "enable_preprocessing": True,
        "model": "bulbul:v3"
    }

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            response = await client.post(
                "https://api.sarvam.ai/text-to-speech",
                headers={
                    "api-subscription-key": api_key,
                    "Content-Type": "application/json"
                },
                json=payload
            )
            response.raise_for_status()
            parsed = response.json()
            audios = parsed.get("audios", [])
            if audios:
                return audios[0] # base64 encoded audio
        except Exception as exc:
            logger.warning("Sarvam TTS failed: %s", exc)
    return None
