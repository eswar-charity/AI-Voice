from pydantic import BaseModel
from typing import List, Optional


class MatchSchema(BaseModel):
    id: str
    resume_id: str
    job_id: str
    score: int
    reasoning: Optional[str] = None
    strengths: List[str] = []
    weaknesses: List[str] = []
    status: str
    created_at: str
    # joined fields
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    candidate_user_id: Optional[str] = None
    resume_file_name: Optional[str] = None
    job_title: Optional[str] = None
    job_company: Optional[str] = None


class MatchRunRequest(BaseModel):
    job_id: str
