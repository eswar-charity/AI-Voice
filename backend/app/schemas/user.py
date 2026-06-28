from pydantic import BaseModel
from typing import Optional, Literal


class UserSchema(BaseModel):
    id: str
    email: str
    full_name: str
    role: Literal["recruiter", "candidate"]
    avatar_url: Optional[str] = None
    created_at: str
