from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.schemas.match import MatchSchema
from app.services.match_service import MatchService
from app.services.auth_service import AuthService

router = APIRouter()
security = HTTPBearer()


def current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    return AuthService().get_current_user(creds.credentials)


@router.get("/my", response_model=List[MatchSchema])
def get_my_matches(user: dict = Depends(current_user)):
    if user["role"] != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only candidates can access their matches",
        )
    return MatchService().get_matches_for_candidate(user["id"])


@router.get("/{job_id}", response_model=List[MatchSchema])
def get_matches(job_id: str, user: dict = Depends(current_user)):
    return MatchService().get_ranked_candidates(job_id)


@router.post("/{job_id}/run", response_model=List[MatchSchema])
async def run_matching(job_id: str, user: dict = Depends(current_user)):
    return await MatchService().run_matching(job_id)
