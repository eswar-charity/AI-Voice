from typing import List

from fastapi import APIRouter, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.schemas.job import JobCreate, JobUpdate, JobSchema
from app.services.job_service import JobService
from app.services.auth_service import AuthService

router = APIRouter()
security = HTTPBearer()


def current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    return AuthService().get_current_user(creds.credentials)


@router.get("", response_model=List[JobSchema])
def list_jobs(user: dict = Depends(current_user)):
    return JobService().list_jobs(user["id"])


@router.post("", response_model=JobSchema, status_code=201)
def create_job(req: JobCreate, user: dict = Depends(current_user)):
    return JobService().create(req, user["id"])


@router.get("/{job_id}", response_model=JobSchema)
def get_job(job_id: str, user: dict = Depends(current_user)):
    return JobService().get_job(job_id)


@router.patch("/{job_id}", response_model=JobSchema)
def update_job(job_id: str, req: JobUpdate, user: dict = Depends(current_user)):
    return JobService().update(job_id, req, user["id"])


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: str, user: dict = Depends(current_user)):
    JobService().delete(job_id, user["id"])
