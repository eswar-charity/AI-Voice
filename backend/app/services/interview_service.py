import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status

from app.repositories.interview_repository import InterviewRepository
from app.repositories.resume_repository import ResumeRepository
from app.repositories.match_repository import MatchRepository
from app.schemas.interview import InterviewCreate, ActivityEvent
from app.agents.interview_agent import interview_graph, generate_single_round_plan
from app.core.interview_rounds import (
    ROUND_ORDER,
    ROUND_DEFINITIONS,
    is_round_plan,
    flatten_questions,
    total_questions,
    voice_for_answer_count,
    get_round_def,
    next_round_type,
    is_final_round,
    legacy_questions_to_plan,
)
from app.services.stt_service import transcribe_audio
from app.services.tts_service import synthesize_speech


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_stored_questions(raw) -> dict | list:
    if is_round_plan(raw):
        return raw
    if isinstance(raw, list) and raw:
        plan = legacy_questions_to_plan(raw)
        return plan if plan else raw
    return raw or []


def _question_count(raw) -> int:
    if is_round_plan(raw):
        return raw.get("total_questions") or total_questions(raw.get("rounds") or [])
    if isinstance(raw, list):
        return len(raw)
    return 0


def _rounds_list(raw) -> list:
    if is_round_plan(raw):
        return raw.get("rounds") or []
    return []


def _latest_by_round(series: list) -> dict[str, dict]:
    """Most recent interview row per round_type in a job/match series."""
    out: dict[str, dict] = {}
    for row in sorted(series, key=lambda r: r.get("created_at", ""), reverse=True):
        rt = row.get("round_type") or "hr"
        if rt not in out:
            out[rt] = row
    return out


def _series_overview_rows() -> list:
    return [
        {
            "id": rd["id"],
            "label": rd["label"],
            "voice_name": rd["voice_name"],
        }
        for rd in ROUND_DEFINITIONS
    ]


class InterviewService:
    def __init__(self):
        self.repo = InterviewRepository()
        self.resume_repo = ResumeRepository()

    def _get_series(self, candidate_id: str, job_id: str, match_id: str | None) -> list:
        return self.repo.find_series(candidate_id, job_id, match_id)

    def _prerequisite_met(self, by_round: dict[str, dict], round_type: str) -> bool:
        if round_type == "hr":
            return True
        if round_type == "technical":
            hr = by_round.get("hr")
            return bool(hr and hr.get("status") == "completed")
        if round_type == "manager":
            tech = by_round.get("technical")
            return bool(tech and tech.get("status") == "completed")
        return False

    def _validate_round_access(
        self, candidate_id: str, job_id: str, match_id: str | None, round_type: str
    ) -> None:
        if round_type not in ROUND_ORDER:
            raise HTTPException(status_code=400, detail="Invalid round type")

        series = self._get_series(candidate_id, job_id, match_id)
        by_round = _latest_by_round(series)

        if not self._prerequisite_met(by_round, round_type):
            prev = "HR" if round_type == "technical" else "Technical"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Complete the {prev} round before starting this one",
            )

        existing = by_round.get(round_type)
        if existing and existing.get("status") == "completed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"The {get_round_def(round_type)['label']} is already completed",
            )

    def get_series_progress(
        self, candidate_id: str, job_id: str, match_id: str | None, user: dict
    ) -> dict:
        if user["role"] == "candidate" and user["id"] != candidate_id:
            raise HTTPException(status_code=403, detail="Forbidden")

        series = self._get_series(candidate_id, job_id, match_id)
        by_round = _latest_by_round(series)

        rounds_out = []
        for rt in ROUND_ORDER:
            rd = get_round_def(rt)
            row = by_round.get(rt)
            unlocked = self._prerequisite_met(by_round, rt)
            status_val = row.get("status") if row else "not_started"
            available = unlocked and (
                not row or status_val in ("pending", "in_progress")
            )
            rounds_out.append(
                {
                    "round_type": rt,
                    "label": rd["label"],
                    "voice_name": rd["voice_name"],
                    "interviewer_title": rd["interviewer_title"],
                    "interview_id": row.get("id") if row else None,
                    "status": status_val,
                    "unlocked": unlocked,
                    "available": available,
                }
            )

        series_complete = all(
            by_round.get(rt, {}).get("status") == "completed" for rt in ROUND_ORDER
        )

        return {
            "job_id": job_id,
            "match_id": match_id,
            "series_complete": series_complete,
            "rounds": rounds_out,
        }

    def create(self, req: InterviewCreate, user: dict) -> dict:
        if user["role"] == "candidate" and req.candidate_id != user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Candidates can only create interviews for themselves",
            )

        if req.match_id:
            match = MatchRepository().find_by_id(req.match_id)
            if not match:
                raise HTTPException(status_code=404, detail="Match not found")
            resume = self.resume_repo.find_by_id(match["resume_id"])
            if resume and req.candidate_id != resume["user_id"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="candidate_id does not match the resume owner",
                )

        round_type = req.round_type or "hr"
        series = self._get_series(req.candidate_id, req.job_id, req.match_id)

        for row in series:
            if row["status"] in ("pending", "in_progress"):
                return row

        if user["role"] == "recruiter":
            by_round = _latest_by_round(series)
            if all(by_round.get(rt, {}).get("status") == "completed" for rt in ROUND_ORDER):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Candidate has already completed all interview rounds",
                )
            round_type = "hr"
        else:
            self._validate_round_access(
                req.candidate_id, req.job_id, req.match_id, round_type
            )

        return self.repo.create(
            {
                "id": str(uuid.uuid4()),
                "candidate_id": req.candidate_id,
                "job_id": req.job_id,
                "match_id": req.match_id,
                "round_type": round_type,
                "status": "pending",
            }
        )

    def retake(self, interview_id: str, user: dict) -> dict:
        interview = self.repo.find_by_id(interview_id)
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")

        if user["role"] == "candidate" and interview["candidate_id"] != user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only retake your own interviews",
            )

        series = self._get_series(
            interview["candidate_id"],
            interview["job_id"],
            interview.get("match_id"),
        )
        for row in series:
            if row["status"] in ("pending", "in_progress"):
                return row

        return self.repo.create(
            {
                "id": str(uuid.uuid4()),
                "candidate_id": interview["candidate_id"],
                "job_id": interview["job_id"],
                "match_id": interview.get("match_id"),
                "round_type": "hr",
                "status": "pending",
            }
        )

    def _get_resume_for_interview(self, interview: dict) -> dict:
        if interview.get("match_id"):
            match = MatchRepository().find_by_id(interview["match_id"])
            if match:
                resume = self.resume_repo.find_by_id(match["resume_id"])
                if resume:
                    return resume

        resumes = self.resume_repo.find_by_user(interview["candidate_id"])
        ready = [r for r in resumes if r.get("status") == "ready" and r.get("raw_text")]
        return ready[0] if ready else {}

    def _get_resume_text(self, interview: dict) -> str:
        return self._get_resume_for_interview(interview).get("raw_text", "") or ""

    def get(self, interview_id: str) -> dict:
        interview = self.repo.find_by_id(interview_id)
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        return interview

    def log_activity(self, interview_id: str, event: ActivityEvent) -> dict:
        return self.repo.append_activity_event(
            interview_id,
            {"event": event.event, "timestamp": event.timestamp},
        )

    def _completion_meta(self, interview: dict, is_complete: bool) -> dict:
        round_type = interview.get("round_type") or "hr"
        nxt = next_round_type(round_type)
        series_complete = is_complete and is_final_round(round_type)
        rd = get_round_def(round_type)
        nxt_rd = get_round_def(nxt) if nxt else None
        return {
            "round_type": round_type,
            "round_complete": is_complete,
            "series_complete": series_complete,
            "next_round_type": nxt if is_complete and nxt else None,
            "next_round_label": nxt_rd["label"] if is_complete and nxt_rd else None,
            "round_label": rd["label"],
        }

    def _round_response_meta(
        self, interview: dict, questions_raw, candidate_answers: int, state: dict
    ) -> dict:
        round_type = interview.get("round_type") or "hr"
        rd = get_round_def(round_type)
        rounds = _rounds_list(questions_raw)
        meta = state.get("round_meta") or {}

        round_index = ROUND_ORDER.index(round_type) if round_type in ROUND_ORDER else 0

        return {
            "question_count": _question_count(questions_raw),
            "question_index": min(candidate_answers + 1, _question_count(questions_raw)),
            "round_id": round_type,
            "round_label": rd["label"],
            "round_index": round_index,
            "total_rounds": len(ROUND_ORDER),
            "voice_name": rd["voice_name"],
            "interviewer_title": rd["interviewer_title"],
            "round_transition": False,
            "rounds": _series_overview_rows(),
        }

    async def _run_turn(self, interview_id: str, candidate_text: str) -> dict:
        interview = self.repo.find_by_id(interview_id)
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")

        if interview["status"] == "completed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This round is already complete",
            )

        round_type = interview.get("round_type") or "hr"

        if interview["status"] == "pending":
            self.repo.update(interview_id, {"status": "in_progress", "started_at": _now()})

        job_data = interview.get("job_descriptions") or {}
        job_text = (
            f"Title: {job_data.get('title', '')}\n"
            f"{job_data.get('description', '')}\n"
            f"Requirements: {job_data.get('requirements', '')}"
        )
        resume_text = self._get_resume_text(interview)

        self.repo.append_transcript_entry(
            interview_id, {"role": "candidate", "content": candidate_text}
        )

        interview = self.repo.find_by_id(interview_id)
        transcript = interview.get("transcript") or []
        questions_raw = _normalize_stored_questions(interview.get("questions"))
        candidate_answers = sum(1 for t in transcript if t.get("role") == "candidate")

        state = await interview_graph.ainvoke(
            {
                "job_description": job_text[:3000],
                "resume_content": resume_text[:3000],
                "round_type": round_type,
                "questions": questions_raw,
                "transcript": transcript,
                "candidate_answer": candidate_text,
                "ai_response": "",
                "is_complete": False,
                "round_transition": False,
                "round_meta": {},
            }
        )

        ai_text = state["ai_response"]
        is_complete = state["is_complete"]

        if state["questions"] and not questions_raw:
            self.repo.update(interview_id, {"questions": state["questions"]})
            questions_raw = state["questions"]

        self.repo.append_transcript_entry(
            interview_id, {"role": "interviewer", "content": ai_text}
        )

        if is_complete:
            self.repo.update(interview_id, {"status": "completed", "ended_at": _now()})

        import base64

        rounds = _rounds_list(questions_raw)
        rd = get_round_def(round_type)
        voice_id = rd.get("voice_id") or voice_for_answer_count(rounds, candidate_answers)
        audio_bytes_out = await synthesize_speech(ai_text, voice_id=voice_id)
        audio_b64 = base64.b64encode(audio_bytes_out).decode() if audio_bytes_out else ""

        completion = self._completion_meta(interview, is_complete)

        return {
            "candidate_text": candidate_text,
            "ai_text": ai_text,
            "audio_b64": audio_b64,
            "use_browser_tts": not audio_b64,
            "is_complete": is_complete,
            **self._round_response_meta(interview, questions_raw, candidate_answers, state),
            **completion,
        }

    async def process_audio_turn(self, interview_id: str, audio_bytes: bytes) -> dict:
        candidate_text = await transcribe_audio(audio_bytes)
        return await self._run_turn(interview_id, candidate_text)

    async def process_text_turn(self, interview_id: str, candidate_text: str) -> dict:
        text = candidate_text.strip()
        if not text:
            raise HTTPException(status_code=400, detail="Empty message")
        return await self._run_turn(interview_id, text)

    async def get_opening_message(self, interview_id: str) -> dict:
        interview = self.repo.find_by_id(interview_id)
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")

        if interview["status"] == "completed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This round is already complete",
            )

        round_type = interview.get("round_type") or "hr"
        rd = get_round_def(round_type)
        round_index = ROUND_ORDER.index(round_type) if round_type in ROUND_ORDER else 0

        job_data = interview.get("job_descriptions") or {}
        job_text = (
            f"Title: {job_data.get('title', '')}\n"
            f"Company: {job_data.get('company', '')}\n"
            f"{job_data.get('description', '')}\n"
            f"Requirements: {job_data.get('requirements', '')}"
        )
        resume = self._get_resume_for_interview(interview)
        resume_text = resume.get("raw_text", "") or ""
        parsed = resume.get("parsed_content") or {}

        questions_raw = _normalize_stored_questions(interview.get("questions"))
        if not questions_raw or (isinstance(questions_raw, list) and not questions_raw):
            questions_raw = await generate_single_round_plan(
                round_type, job_text, resume_text, parsed
            )
            self.repo.update(interview_id, {"questions": questions_raw})

        flat = flatten_questions(_rounds_list(questions_raw))
        first_question = flat[0] if flat else "Tell me about yourself."
        total = _question_count(questions_raw)

        position = f"{job_data.get('title', 'position')} role at {job_data.get('company', 'the company')}"
        if round_type == "hr":
            greeting = (
                f"Welcome! I'm {rd['voice_name']}, your {rd['interviewer_title']} "
                f"for the {position}. "
                f"This is your {rd['label']} — {total} tailored questions, taken separately from the other rounds so you can prepare between each one. "
                "When you're ready, press and hold the record button to answer. "
                f"{first_question}"
            )
        else:
            greeting = (
                f"Welcome back! I'm {rd['voice_name']}, your {rd['interviewer_title']}. "
                f"This is your {rd['label']} for the {position} — {total} questions. "
                "Take your time and answer when ready. "
                f"{first_question}"
            )

        self.repo.append_transcript_entry(
            interview_id, {"role": "interviewer", "content": greeting}
        )

        import base64

        audio_bytes = await synthesize_speech(greeting, voice_id=rd.get("voice_id"))
        audio_b64 = base64.b64encode(audio_bytes).decode() if audio_bytes else ""

        return {
            "ai_text": greeting,
            "audio_b64": audio_b64,
            "use_browser_tts": not audio_b64,
            "question_count": total,
            "question_index": 1,
            "round_id": round_type,
            "round_type": round_type,
            "round_label": rd["label"],
            "round_index": round_index,
            "total_rounds": len(ROUND_ORDER),
            "voice_name": rd["voice_name"],
            "interviewer_title": rd["interviewer_title"],
            "round_transition": False,
            "rounds": _series_overview_rows(),
            "round_complete": False,
            "series_complete": False,
            "next_round_type": None,
            "next_round_label": None,
        }

    def merged_series_transcript(self, interview: dict) -> list:
        series = self._get_series(
            interview["candidate_id"],
            interview["job_id"],
            interview.get("match_id"),
        )
        by_round = _latest_by_round(series)
        merged: list = []
        for rt in ROUND_ORDER:
            row = by_round.get(rt)
            if not row or row.get("status") != "completed":
                continue
            rd = get_round_def(rt)
            merged.append(
                {"role": "interviewer", "content": f"[{rd['label']} begins]"}
            )
            merged.extend(row.get("transcript") or [])
        return merged

    def series_expected_questions(self, interview: dict) -> int:
        series = self._get_series(
            interview["candidate_id"],
            interview["job_id"],
            interview.get("match_id"),
        )
        by_round = _latest_by_round(series)
        total = 0
        for rt in ROUND_ORDER:
            row = by_round.get(rt)
            if not row:
                total += get_round_def(rt)["question_count"]
                continue
            raw = _normalize_stored_questions(row.get("questions"))
            total += _question_count(raw) or get_round_def(rt)["question_count"]
        return total or 7
