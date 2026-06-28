"""Whisper speech-to-text via OpenAI API."""
import io
from openai import AsyncOpenAI
from app.core.config import settings


async def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
    if not audio_bytes or len(audio_bytes) < 100:
        raise ValueError("Recording too short — hold the mic button longer while speaking")

    if not settings.OPENAI_API_KEY:
        raise ValueError(
            "Server transcription unavailable. Use Chrome or Edge so your browser can transcribe speech."
        )

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, max_retries=0)

    ext = "webm" if "webm" in mime_type else "mp4"
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = f"audio.{ext}"

    try:
        result = await client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language="en",
        )
    except Exception as exc:
        err = str(exc).lower()
        if "insufficient_quota" in err or "429" in err or "quota" in err:
            raise ValueError(
                "Server transcription is unavailable. Use Chrome or Edge, hold the mic button, and speak clearly."
            ) from exc
        raise ValueError(
            "Could not transcribe audio. Hold the mic button longer and speak clearly."
        ) from exc

    text = (result.text or "").strip()
    if not text:
        raise ValueError("Could not understand audio — please speak clearly and try again")
    return text
