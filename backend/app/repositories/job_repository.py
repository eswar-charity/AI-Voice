from typing import Optional, List
from app.core.supabase import get_supabase


class JobRepository:
    TABLE = "job_descriptions"

    def __init__(self):
        self.db = get_supabase()

    def find_all(self) -> List[dict]:
        res = (
            self.db.table(self.TABLE)
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []

    def find_by_recruiter(self, recruiter_id: str) -> List[dict]:
        res = (
            self.db.table(self.TABLE)
            .select("*")
            .eq("recruiter_id", recruiter_id)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []

    def find_by_id(self, job_id: str) -> Optional[dict]:
        res = (
            self.db.table(self.TABLE)
            .select("*")
            .eq("id", job_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def create(self, data: dict) -> dict:
        res = self.db.table(self.TABLE).insert(data).execute()
        return res.data[0]

    def update(self, job_id: str, data: dict) -> dict:
        res = (
            self.db.table(self.TABLE)
            .update(data)
            .eq("id", job_id)
            .execute()
        )
        return res.data[0]

    def delete(self, job_id: str) -> None:
        self.db.table(self.TABLE).delete().eq("id", job_id).execute()
