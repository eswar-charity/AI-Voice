from pydantic import BaseModel
from typing import Optional, Literal


class JobCreate(BaseModel):
    title: str
    company: str
    location: Optional[str] = None
    employment_type: Literal["full_time", "part_time", "contract", "internship"] = "full_time"
    description: str
    requirements: str


class JobUpdate(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    status: Optional[Literal["open", "closed", "draft"]] = None


class JobSchema(BaseModel):
    id: str
    recruiter_id: str
    title: str
    company: str
    location: Optional[str] = None
    employment_type: str
    description: str
    requirements: str
    status: str
    created_at: str
