from typing import List

from fastapi import HTTPException

from app.repositories.match_repository import MatchRepository
from app.repositories.resume_repository import ResumeRepository
from app.repositories.job_repository import JobRepository
from app.agents.matching_agent import matching_graph, sanitize_match_reasoning


MATCH_INTERVIEW_THRESHOLD = 50


class MatchService:
    def __init__(self):
        self.match_repo = MatchRepository()
        self.resume_repo = ResumeRepository()
        self.job_repo = JobRepository()

    def _enrich_match(self, row: dict) -> dict:
        resume_data = row.get("resumes") or {}
        user_data = resume_data.get("users") or {}
        job_data = row.get("job_descriptions") or {}
        parsed = resume_data.get("parsed_content") or {}
        strengths = row.get("strengths") or []
        weaknesses = row.get("weaknesses") or []
        return {
            **row,
            "candidate_name": parsed.get("name") or user_data.get("full_name"),
            "candidate_email": parsed.get("email") or user_data.get("email"),
            "candidate_user_id": resume_data.get("user_id"),
            "resume_file_name": resume_data.get("file_name"),
            "job_title": job_data.get("title"),
            "job_company": job_data.get("company"),
            "reasoning": sanitize_match_reasoning(
                row.get("reasoning") or "",
                score=int(row.get("score") or 0),
                strengths=strengths,
                weaknesses=weaknesses,
            ),
        }

    def get_ranked_candidates(self, job_id: str) -> List[dict]:
        rows = self.match_repo.find_by_job(job_id)
        return [self._enrich_match(row) for row in rows]

    def get_matches_for_candidate(self, user_id: str) -> List[dict]:
        resumes = self.resume_repo.find_by_user(user_id)
        ready_ids = [r["id"] for r in resumes if r.get("status") == "ready"]
        rows = self.match_repo.find_by_resume_ids(ready_ids)
        return [
            self._enrich_match(row)
            for row in rows
            if row.get("score", 0) >= MATCH_INTERVIEW_THRESHOLD
        ]

    async def run_matching(self, job_id: str) -> List[dict]:
        job = self.job_repo.find_by_id(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        resumes = self.resume_repo.find_all()
        ready_resumes = [r for r in resumes if r.get("status") == "ready" and r.get("raw_text")]

        if not ready_resumes:
            raise HTTPException(status_code=422, detail="No ready resumes found to match")

        job_text = f"Title: {job['title']}\nCompany: {job['company']}\n\n{job['description']}\n\nRequirements:\n{job['requirements']}"

        results = []
        errors = []
        for resume in ready_resumes:
            try:
                state = await matching_graph.ainvoke(
                    {
                        "resume_content": resume["raw_text"][:6000],
                        "job_description": job_text[:3000],
                        "parsed_content": resume.get("parsed_content") or {},
                        "score": 0,
                        "reasoning": "",
                        "strengths": [],
                        "weaknesses": [],
                    }
                )
                self.match_repo.upsert(
                    {
                        "resume_id": resume["id"],
                        "job_id": job_id,
                        "score": state["score"],
                        "reasoning": state["reasoning"],
                        "strengths": state["strengths"],
                        "weaknesses": state["weaknesses"],
                        "status": "matched",
                    }
                )
                results.append(state)
            except Exception as exc:
                errors.append(str(exc))
                self.match_repo.upsert(
                    {
                        "resume_id": resume["id"],
                        "job_id": job_id,
                        "score": 0,
                        "reasoning": "Unable to evaluate this resume against the job. Please try again later.",
                        "status": "error",
                    }
                )

        ranked = self.get_ranked_candidates(job_id)
        matched = [r for r in ranked if r.get("status") == "matched"]
        if not matched and ready_resumes:
            detail = errors[0] if errors else "All resume matches failed"
            raise HTTPException(status_code=502, detail=detail)

        return ranked
