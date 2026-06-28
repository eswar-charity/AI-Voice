import uuid
from typing import List

from fastapi import HTTPException, status

from app.repositories.job_repository import JobRepository
from app.schemas.job import JobCreate, JobUpdate


class JobService:
    def __init__(self):
        self.repo = JobRepository()

    def list_jobs(self, recruiter_id: str) -> List[dict]:
        return self.repo.find_by_recruiter(recruiter_id)

    def get_job(self, job_id: str) -> dict:
        job = self.repo.find_by_id(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return job

    def create(self, req: JobCreate, recruiter_id: str) -> dict:
        return self.repo.create(
            {
                "id": str(uuid.uuid4()),
                "recruiter_id": recruiter_id,
                **req.model_dump(),
            }
        )

    def update(self, job_id: str, req: JobUpdate, recruiter_id: str) -> dict:
        job = self.repo.find_by_id(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        if job["recruiter_id"] != recruiter_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        return self.repo.update(job_id, req.model_dump(exclude_none=True))

    def delete(self, job_id: str, recruiter_id: str) -> None:
        job = self.repo.find_by_id(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        if job["recruiter_id"] != recruiter_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        self.repo.delete(job_id)
