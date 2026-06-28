from pydantic import BaseModel
from typing import List, Optional


class ReportSchema(BaseModel):
    id: str
    interview_id: str
    candidate_id: str
    job_id: str
    overall_score: Optional[int] = None
    technical_score: Optional[int] = None
    communication_score: Optional[int] = None
    cultural_fit_score: Optional[int] = None
    summary: Optional[str] = None
    strengths: List[str] = []
    areas_for_improvement: List[str] = []
    recommendation: Optional[str] = None
    status: str
    created_at: str
    # joined
    candidate_name: Optional[str] = None
    job_title: Optional[str] = None
