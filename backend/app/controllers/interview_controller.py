from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.schemas.interview import (
    InterviewCreate,
    InterviewSchema,
    ActivityEvent,
    InterviewSeriesProgress,
)
from app.services.interview_service import InterviewService
from app.services.auth_service import AuthService

router = APIRouter()
security = HTTPBearer()


def current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    return AuthService().get_current_user(creds.credentials)


@router.post("", response_model=InterviewSchema, status_code=201)
def create_interview(
    req: InterviewCreate,
    user: dict = Depends(current_user),
):
    return InterviewService().create(req, user)


@router.get("/my", response_model=List[InterviewSchema])
def get_my_interviews(user: dict = Depends(current_user)):
    svc = InterviewService()
    rows = svc.repo.find_by_candidate(user["id"])
    return [
        {
            **row,
            "round_type": row.get("round_type") or "hr",
            "candidate_name": (row.get("users") or {}).get("full_name"),
            "job_title": (row.get("job_descriptions") or {}).get("title"),
        }
        for row in rows
    ]


@router.get("/series/progress", response_model=InterviewSeriesProgress)
def get_series_progress(
    job_id: str,
    match_id: str | None = None,
    user: dict = Depends(current_user),
):
    return InterviewService().get_series_progress(user["id"], job_id, match_id, user)


@router.post("/{interview_id}/retake", response_model=InterviewSchema, status_code=201)
def retake_interview(interview_id: str, user: dict = Depends(current_user)):
    row = InterviewService().retake(interview_id, user)
    return {
        **row,
        "job_title": None,
    }


@router.get("/{interview_id}", response_model=InterviewSchema)
def get_interview(interview_id: str, user: dict = Depends(current_user)):
    return InterviewService().get(interview_id)


@router.get("/candidate/{candidate_id}", response_model=List[InterviewSchema])
def get_candidate_interviews(candidate_id: str, user: dict = Depends(current_user)):
    svc = InterviewService()
    return svc.repo.find_by_candidate(candidate_id)


@router.post("/{interview_id}/activity", response_model=InterviewSchema)
def log_activity(
    interview_id: str,
    event: ActivityEvent,
    user: dict = Depends(current_user),
):
    return InterviewService().log_activity(interview_id, event)
