from pydantic import BaseModel
from typing import List, Optional, Literal, Any


class InterviewCreate(BaseModel):
    candidate_id: str
    job_id: str
    match_id: Optional[str] = None
    round_type: Literal["hr", "technical", "manager"] = "hr"


class SeriesRoundStatus(BaseModel):
    round_type: str
    label: str
    voice_name: str
    interviewer_title: str
    interview_id: Optional[str] = None
    status: str
    unlocked: bool
    available: bool


class InterviewSeriesProgress(BaseModel):
    job_id: str
    match_id: Optional[str] = None
    series_complete: bool
    rounds: List[SeriesRoundStatus]


class ActivityEvent(BaseModel):
    event: str  # tab_switch, fullscreen_exit, copy, paste, right_click, devtools
    timestamp: str


class InterviewSchema(BaseModel):
    id: str
    candidate_id: str
    job_id: str
    match_id: Optional[str] = None
    status: str
    round_type: str = "hr"
    questions: List[Any] = []
    transcript: List[Any] = []
    activity_log: List[Any] = []
    violation_count: int
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    created_at: str
    # joined
    candidate_name: Optional[str] = None
    job_title: Optional[str] = None
