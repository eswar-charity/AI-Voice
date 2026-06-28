import io
import re
import uuid
from typing import List

from fastapi import HTTPException, UploadFile, status
from openai import AsyncOpenAI

from app.core.config import settings
from app.repositories.resume_repository import ResumeRepository

_TECH_SKILLS = (
    "python", "javascript", "typescript", "react", "node", "fastapi", "django",
    "flask", "sql", "postgres", "mongodb", "aws", "docker", "kubernetes", "java",
    "golang", "rust", "c++", "machine learning", "deep learning", "nlp", "llm",
    "openai", "langchain", "langgraph", "datascience", "data science", "tensorflow",
    "pytorch", "git", "ci/cd", "rest", "graphql", "redis", "kafka", "spark",
)


def _parse_resume_locally(raw_text: str) -> dict:
    text_lower = raw_text.lower()
    skills = [s for s in _TECH_SKILLS if s in text_lower]
    email_match = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", raw_text)
    name_line = raw_text.strip().split("\n")[0].strip() if raw_text.strip() else ""
    return {
        "name": name_line[:80] if name_line and "@" not in name_line else None,
        "email": email_match.group(0) if email_match else None,
        "skills": skills,
        "summary": raw_text[:300].replace("\n", " ").strip(),
    }


async def _extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(file_bytes))
        return "\n".join(page.extract_text() or "" for page in reader.pages).strip()
    except Exception:
        return ""


async def _parse_resume_with_llm(raw_text: str) -> dict:
    if not raw_text:
        return {}
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, max_retries=0)
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        temperature=0,
        messages=[
            {
                "role": "system",
                "content": (
                    "Extract structured data from this resume. Return JSON with: "
                    "name, email, phone, summary, skills (array), "
                    "experience (array of {title, company, duration, description}), "
                    "education (array of {degree, institution, year})."
                ),
            },
            {"role": "user", "content": raw_text[:8000]},
        ],
    )
    import json
    try:
        return json.loads(response.choices[0].message.content)
    except Exception:
        return {}


async def _upload_to_openai_files(file_bytes: bytes, filename: str) -> str:
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, max_retries=0)
    buf = io.BytesIO(file_bytes)
    buf.name = filename
    result = await client.files.create(file=buf, purpose="assistants")
    return result.id


class ResumeService:
    def __init__(self):
        self.repo = ResumeRepository()

    async def upload(self, file: UploadFile, uploader_id: str) -> dict:
        if file.content_type not in ("application/pdf",):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Only PDF files are supported",
            )

        file_bytes = await file.read()
        resume_id = str(uuid.uuid4())

        # Create record immediately with processing status
        record = self.repo.create(
            {
                "id": resume_id,
                "user_id": uploader_id,
                "file_name": file.filename,
                "file_size": len(file_bytes),
                "status": "processing",
            }
        )

        # Parse and upload in background (fire-and-forget pattern for demo;
        # in production use a task queue)
        try:
            raw_text = await _extract_text_from_pdf(file_bytes)
            if not raw_text:
                record = self.repo.update(resume_id, {"status": "error"})
                return record

            parsed: dict = {}
            openai_file_id = None

            if settings.OPENAI_API_KEY:
                try:
                    parsed = await _parse_resume_with_llm(raw_text)
                except Exception:
                    pass
                try:
                    openai_file_id = await _upload_to_openai_files(
                        file_bytes, file.filename or "resume.pdf"
                    )
                except Exception:
                    pass

            if not parsed:
                parsed = _parse_resume_locally(raw_text)

            record = self.repo.update(
                resume_id,
                {
                    "raw_text": raw_text,
                    "parsed_content": parsed,
                    "openai_file_id": openai_file_id,
                    "status": "ready",
                },
            )
        except Exception:
            record = self.repo.update(resume_id, {"status": "error"})

        return record

    def list_resumes(self, user: dict) -> List[dict]:
        if user["role"] == "recruiter":
            return self.repo.find_all()
        return self.repo.find_by_user(user["id"])

    def delete(self, resume_id: str, user: dict) -> None:
        resume = self.repo.find_by_id(resume_id)
        if not resume:
            raise HTTPException(status_code=404, detail="Resume not found")
        if resume["user_id"] != user["id"] and user["role"] != "recruiter":
            raise HTTPException(status_code=403, detail="Not authorized")
        self.repo.delete(resume_id)
