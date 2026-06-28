from typing import Optional, List
from app.core.supabase import get_supabase


class ReportRepository:
    TABLE = "reports"

    def __init__(self):
        self.db = get_supabase()

    def create(self, data: dict) -> dict:
        res = self.db.table(self.TABLE).insert(data).execute()
        return res.data[0]

    def find_by_id(self, report_id: str) -> Optional[dict]:
        res = (
            self.db.table(self.TABLE)
            .select("*, users(full_name, email), job_descriptions(title, company)")
            .eq("id", report_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def find_by_interview(self, interview_id: str) -> Optional[dict]:
        res = (
            self.db.table(self.TABLE)
            .select("*")
            .eq("interview_id", interview_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def find_all(self) -> List[dict]:
        res = (
            self.db.table(self.TABLE)
            .select("*, users(full_name, email), job_descriptions(title, company)")
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []

    def update(self, report_id: str, data: dict) -> dict:
        res = (
            self.db.table(self.TABLE)
            .update(data)
            .eq("id", report_id)
            .execute()
        )
        return res.data[0]
