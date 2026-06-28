from typing import Optional, List
from app.core.supabase import get_supabase


class MatchRepository:
    TABLE = "matches"

    def __init__(self):
        self.db = get_supabase()

    def find_by_job(self, job_id: str) -> List[dict]:
        res = (
            self.db.table(self.TABLE)
            .select("*, resumes(file_name, user_id, users(full_name, email))")
            .eq("job_id", job_id)
            .order("score", desc=True)
            .execute()
        )
        return res.data or []

    def find_by_resume_and_job(self, resume_id: str, job_id: str) -> Optional[dict]:
        res = (
            self.db.table(self.TABLE)
            .select("*")
            .eq("resume_id", resume_id)
            .eq("job_id", job_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def upsert(self, data: dict) -> dict:
        res = (
            self.db.table(self.TABLE)
            .upsert(data, on_conflict="resume_id,job_id")
            .execute()
        )
        if res.data:
            return res.data[0]
        existing = self.find_by_resume_and_job(data["resume_id"], data["job_id"])
        if existing:
            return existing
        raise RuntimeError("Match upsert returned no data")

    def find_by_resume_ids(self, resume_ids: List[str]) -> List[dict]:
        if not resume_ids:
            return []
        res = (
            self.db.table(self.TABLE)
            .select(
                "*, resumes(file_name, user_id, parsed_content), "
                "job_descriptions(title, company, description)"
            )
            .in_("resume_id", resume_ids)
            .order("score", desc=True)
            .execute()
        )
        return res.data or []

    def find_by_id(self, match_id: str) -> Optional[dict]:
        res = (
            self.db.table(self.TABLE)
            .select("*")
            .eq("id", match_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None
