from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.schemas.resume import ResumeSchema
from app.services.resume_service import ResumeService
from app.services.auth_service import AuthService
from typing import List

router = APIRouter()
security = HTTPBearer()


def current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    return AuthService().get_current_user(creds.credentials)


@router.get("", response_model=List[ResumeSchema])
def list_resumes(user: dict = Depends(current_user)):
    return ResumeService().list_resumes(user)


@router.post("", response_model=ResumeSchema, status_code=201)
async def upload_resume(
    file: UploadFile = File(...),
    user: dict = Depends(current_user),
):
    return await ResumeService().upload(file, user["id"])


@router.delete("/{resume_id}", status_code=204)
def delete_resume(resume_id: str, user: dict = Depends(current_user)):
    ResumeService().delete(resume_id, user)
