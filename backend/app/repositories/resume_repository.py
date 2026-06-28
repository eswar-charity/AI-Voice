from typing import Optional, List
from app.core.supabase import get_supabase


class ResumeRepository:
    TABLE = "resumes"

    def __init__(self):
        self.db = get_supabase()

    def find_by_user(self, user_id: str) -> List[dict]:
        res = (
            self.db.table(self.TABLE)
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []

    def find_all(self) -> List[dict]:
        res = (
            self.db.table(self.TABLE)
            .select("*, users(full_name, email)")
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []

    def find_by_id(self, resume_id: str) -> Optional[dict]:
        res = (
            self.db.table(self.TABLE)
            .select("*")
            .eq("id", resume_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def create(self, data: dict) -> dict:
        res = self.db.table(self.TABLE).insert(data).execute()
        return res.data[0]

    def update(self, resume_id: str, data: dict) -> dict:
        res = (
            self.db.table(self.TABLE)
            .update(data)
            .eq("id", resume_id)
            .execute()
        )
        return res.data[0]

    def delete(self, resume_id: str) -> None:
        self.db.table(self.TABLE).delete().eq("id", resume_id).execute()
