"""
WebSocket handler for the real-time AI voice interview.

Message protocol
────────────────
Client → Server:
  {"type": "start"}                               – request opening greeting
  {"type": "audio", "data": "<base64 webm>"}      – candidate audio submission
  {"type": "activity", "event": "<violation>"}    – activity tracking event
  {"type": "end"}                                 – candidate ends interview

Server → Client:
  {"type": "opening", "text": "...", "audio": "<base64 mp3>"}
  {"type": "transcript", "candidate": "..."}      – transcribed candidate speech
  {"type": "response", "text": "...", "audio": "<base64 mp3>", "is_complete": false}
  {"type": "complete"}                            – interview finished
  {"type": "error", "message": "..."}
"""
import base64
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.services.interview_service import InterviewService
from app.services.auth_service import AuthService
from app.services.report_service import ReportService
from app.repositories.interview_repository import InterviewRepository

router = APIRouter()


async def _generate_report_safe(interview_id: str) -> None:
    try:
        await ReportService().generate(interview_id)
    except Exception:
        pass


def _round_fields(result: dict) -> dict:
    return {
        k: result[k]
        for k in (
            "question_count",
            "question_index",
            "round_id",
            "round_type",
            "round_label",
            "round_index",
            "total_rounds",
            "voice_name",
            "interviewer_title",
            "round_transition",
            "rounds",
            "round_complete",
            "series_complete",
            "next_round_type",
            "next_round_label",
        )
        if k in result
    }


async def _send_turn_response(websocket: WebSocket, interview_id: str, result: dict) -> None:
    await websocket.send_json(
        {"type": "transcript", "candidate": result["candidate_text"]}
    )
    await websocket.send_json(
        {
            "type": "response",
            "text": result["ai_text"],
            "audio": result["audio_b64"],
            "use_browser_tts": result.get("use_browser_tts", False),
            "is_complete": result["is_complete"],
            **_round_fields(result),
        }
    )
    if result["is_complete"]:
        await websocket.send_json(
            {
                "type": "complete",
                "series_complete": result.get("series_complete", False),
                "round_complete": result.get("round_complete", True),
                "next_round_type": result.get("next_round_type"),
                "next_round_label": result.get("next_round_label"),
            }
        )
        if result.get("series_complete"):
            await _generate_report_safe(interview_id)


async def _authenticate(token: str) -> dict | None:
    try:
        return AuthService().get_current_user(token)
    except Exception:
        return None


@router.websocket("/interview/{interview_id}")
async def interview_ws(
    websocket: WebSocket,
    interview_id: str,
    token: str = Query(...),
):
    user = await _authenticate(token)
    if not user:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    interview = InterviewRepository().find_by_id(interview_id)
    if not interview:
        await websocket.close(code=4004, reason="Interview not found")
        return

    is_candidate = interview["candidate_id"] == user["id"]
    is_recruiter = user["role"] == "recruiter"
    if not is_candidate and not is_recruiter:
        await websocket.close(code=4003, reason="Forbidden")
        return

    await websocket.accept()
    svc = InterviewService()

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type")

            try:
                if msg_type == "start":
                    opening = await svc.get_opening_message(interview_id)
                    await websocket.send_json(
                        {
                            "type": "opening",
                            "text": opening["ai_text"],
                            "audio": opening["audio_b64"],
                            "use_browser_tts": opening.get("use_browser_tts", False),
                            **_round_fields(opening),
                        }
                    )

                elif msg_type == "audio":
                    interview = InterviewRepository().find_by_id(interview_id)
                    if interview and interview.get("status") == "completed":
                        await websocket.send_json(
                            {
                                "type": "error",
                                "message": "This round is already complete.",
                            }
                        )
                        continue
                    audio_bytes = base64.b64decode(msg["data"])
                    result = await svc.process_audio_turn(interview_id, audio_bytes)
                    await _send_turn_response(websocket, interview_id, result)

                elif msg_type == "text":
                    interview = InterviewRepository().find_by_id(interview_id)
                    if interview and interview.get("status") == "completed":
                        await websocket.send_json(
                            {
                                "type": "error",
                                "message": "This round is already complete.",
                            }
                        )
                        continue
                    result = await svc.process_text_turn(interview_id, msg.get("text", ""))
                    await _send_turn_response(websocket, interview_id, result)

                elif msg_type == "activity":
                    event = msg.get("event", "unknown")
                    InterviewRepository().append_activity_event(
                        interview_id,
                        {"event": event, "timestamp": msg.get("timestamp", "")},
                    )

                elif msg_type == "end":
                    from datetime import datetime, timezone

                    interview = InterviewRepository().find_by_id(interview_id)
                    InterviewRepository().update(
                        interview_id,
                        {
                            "status": "completed",
                            "ended_at": datetime.now(timezone.utc).isoformat(),
                        },
                    )
                    round_type = (interview or {}).get("round_type") or "hr"
                    from app.core.interview_rounds import is_final_round, next_round_type, get_round_def

                    series_complete = is_final_round(round_type)
                    nxt = next_round_type(round_type)
                    nxt_rd = get_round_def(nxt) if nxt else None
                    await websocket.send_json(
                        {
                            "type": "complete",
                            "series_complete": series_complete,
                            "round_complete": True,
                            "next_round_type": nxt,
                            "next_round_label": nxt_rd["label"] if nxt_rd else None,
                        }
                    )
                    if series_complete:
                        await _generate_report_safe(interview_id)

            except ValueError as exc:
                await websocket.send_json({"type": "error", "message": str(exc)})
            except Exception:
                await websocket.send_json(
                    {
                        "type": "error",
                        "message": "Could not process your response. Hold the mic and try again.",
                    }
                )

    except WebSocketDisconnect:
        pass
