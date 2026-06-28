from typing import Optional
from app.core.supabase import get_supabase, run_db_query


class UserRepository:
    TABLE = "users"

    def __init__(self):
        self.db = get_supabase()

    def find_by_email(self, email: str) -> Optional[dict]:
        def _query():
            res = (
                self.db.table(self.TABLE)
                .select("*")
                .eq("email", email)
                .limit(1)
                .execute()
            )
            return res.data[0] if res.data else None

        return run_db_query(_query)

    def find_by_id(self, user_id: str) -> Optional[dict]:
        def _query():
            res = (
                self.db.table(self.TABLE)
                .select("*")
                .eq("id", user_id)
                .limit(1)
                .execute()
            )
            return res.data[0] if res.data else None

        return run_db_query(_query)

    def create(self, data: dict) -> dict:
        def _query():
            res = self.db.table(self.TABLE).insert(data).execute()
            return res.data[0]

        return run_db_query(_query)
