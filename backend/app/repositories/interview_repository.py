from typing import Optional, List
from app.core.supabase import get_supabase, run_db_query


class InterviewRepository:
    TABLE = "interviews"

    def __init__(self):
        self.db = get_supabase()

    def create(self, data: dict) -> dict:
        def _query():
            res = self.db.table(self.TABLE).insert(data).execute()
            return res.data[0]

        return run_db_query(_query)

    def find_by_id(self, interview_id: str) -> Optional[dict]:
        def _query():
            res = (
                self.db.table(self.TABLE)
                .select(
                    "*, users(full_name, email), "
                    "job_descriptions(title, company, description, requirements)"
                )
                .eq("id", interview_id)
                .limit(1)
                .execute()
            )
            return res.data[0] if res.data else None

        return run_db_query(_query)

    def find_by_candidate(self, candidate_id: str) -> List[dict]:
        def _query():
            res = (
                self.db.table(self.TABLE)
                .select("*, job_descriptions(title, company)")
                .eq("candidate_id", candidate_id)
                .order("created_at", desc=True)
                .execute()
            )
            return res.data or []

        return run_db_query(_query)

    def find_series(
        self, candidate_id: str, job_id: str, match_id: Optional[str] = None
    ) -> List[dict]:
        def _query():
            q = (
                self.db.table(self.TABLE)
                .select("*, job_descriptions(title, company)")
                .eq("candidate_id", candidate_id)
                .eq("job_id", job_id)
            )
            if match_id:
                q = q.eq("match_id", match_id)
            res = q.order("created_at", desc=True).execute()
            return res.data or []

        return run_db_query(_query)

    def find_by_job(self, job_id: str) -> List[dict]:
        res = (
            self.db.table(self.TABLE)
            .select("*, users(full_name, email)")
            .eq("job_id", job_id)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []

    def update(self, interview_id: str, data: dict) -> dict:
        res = (
            self.db.table(self.TABLE)
            .update(data)
            .eq("id", interview_id)
            .execute()
        )
        return res.data[0]

    def append_transcript_entry(self, interview_id: str, entry: dict) -> None:
        interview = self.find_by_id(interview_id)
        if not interview:
            return
        transcript = interview.get("transcript", []) or []
        transcript.append(entry)
        self.update(interview_id, {"transcript": transcript})

    def append_activity_event(self, interview_id: str, event: dict) -> dict:
        interview = self.find_by_id(interview_id)
        if not interview:
            return {}
        log = interview.get("activity_log", []) or []
        log.append(event)
        count = interview.get("violation_count", 0) + 1
        return self.update(interview_id, {"activity_log": log, "violation_count": count})
