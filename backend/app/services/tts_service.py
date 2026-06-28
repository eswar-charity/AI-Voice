"""ElevenLabs text-to-speech via HTTP API. Returns None when unavailable."""
import httpx
from app.core.config import settings
from app.core.interview_rounds import VOICE_BELLA

DEFAULT_VOICE_ID = VOICE_BELLA


async def synthesize_speech(text: str, voice_id: str | None = None) -> bytes | None:
    if not settings.ELEVENLABS_API_KEY or not text.strip():
        return None

    vid = voice_id or DEFAULT_VOICE_ID
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{vid}"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                url,
                headers={
                    "xi-api-key": settings.ELEVENLABS_API_KEY,
                    "Content-Type": "application/json",
                    "Accept": "audio/mpeg",
                },
                json={
                    "text": text,
                    "model_id": "eleven_turbo_v2_5",
                    "voice_settings": {
                        "stability": 0.55,
                        "similarity_boost": 0.75,
                    },
                },
            )
            response.raise_for_status()
            return response.content
    except Exception:
        return None
