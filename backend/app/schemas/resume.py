from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class ResumeCreate(BaseModel):
    pass  # handled via multipart upload


class ResumeSchema(BaseModel):
    id: str
    user_id: str
    file_name: str
    file_size: int
    openai_file_id: Optional[str] = None
    parsed_content: Optional[Any] = None
    status: str
    created_at: str
