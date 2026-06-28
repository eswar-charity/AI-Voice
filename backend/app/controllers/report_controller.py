from typing import List

from fastapi import APIRouter, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.schemas.report import ReportSchema
from app.services.report_service import ReportService
from app.services.auth_service import AuthService

router = APIRouter()
security = HTTPBearer()


def current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    return AuthService().get_current_user(creds.credentials)


@router.get("", response_model=List[ReportSchema])
def list_reports(user: dict = Depends(current_user)):
    return ReportService().list_reports(user)


@router.get("/{report_id}", response_model=ReportSchema)
def get_report(report_id: str, user: dict = Depends(current_user)):
    return ReportService().get_report(report_id)


@router.post("/generate/{interview_id}", response_model=ReportSchema)
async def generate_report(interview_id: str, user: dict = Depends(current_user)):
    return await ReportService().generate(interview_id)
