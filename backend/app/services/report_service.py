import uuid

from fastapi import HTTPException

from app.repositories.report_repository import ReportRepository
from app.repositories.interview_repository import InterviewRepository
from app.repositories.resume_repository import ResumeRepository
from app.repositories.job_repository import JobRepository
from app.agents.report_agent import report_graph
from app.core.interview_rounds import is_final_round
from app.services.interview_service import InterviewService


class ReportService:
    def __init__(self):
        self.repo = ReportRepository()
        self.interview_repo = InterviewRepository()
        self.resume_repo = ResumeRepository()
        self.job_repo = JobRepository()

    def list_reports(self, user: dict) -> list:
        rows = self.repo.find_all()
        if user["role"] == "candidate":
            rows = [r for r in rows if r.get("candidate_id") == user["id"]]
        results = []
        for row in rows:
            user_data = row.get("users") or {}
            job_data = row.get("job_descriptions") or {}
            results.append(
                {
                    **row,
                    "candidate_name": user_data.get("full_name"),
                    "job_title": job_data.get("title"),
                }
            )
        return results

    def get_report(self, report_id: str) -> dict:
        report = self.repo.find_by_id(report_id)
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        user_data = report.get("users") or {}
        job_data = report.get("job_descriptions") or {}
        return {
            **report,
            "candidate_name": user_data.get("full_name"),
            "job_title": job_data.get("title"),
        }

    async def generate(self, interview_id: str) -> dict:
        interview = self.interview_repo.find_by_id(interview_id)
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        if interview["status"] != "completed":
            raise HTTPException(status_code=422, detail="Interview not yet completed")

        round_type = interview.get("round_type") or "hr"
        if not is_final_round(round_type):
            raise HTTPException(
                status_code=422,
                detail="Report is generated after all three rounds are complete",
            )

        svc = InterviewService()
        existing = self.repo.find_by_interview(interview_id)
        if existing and existing["status"] == "ready":
            return existing
        if existing and existing["status"] == "generating":
            return existing
        # Re-generate reports that previously failed (status error)

        if existing:
            report_id = existing["id"]
        else:
            report_id = str(uuid.uuid4())
            try:
                self.repo.create(
                    {
                        "id": report_id,
                        "interview_id": interview_id,
                        "candidate_id": interview["candidate_id"],
                        "job_id": interview["job_id"],
                        "status": "generating",
                    }
                )
            except Exception:
                existing = self.repo.find_by_interview(interview_id)
                if not existing:
                    raise
                if existing["status"] == "ready":
                    return existing
                report_id = existing["id"]

        job_data = interview.get("job_descriptions") or {}
        job_text = (
            f"Title: {job_data.get('title', '')}\n"
            f"{job_data.get('description', '')}\n"
            f"Requirements: {job_data.get('requirements', '')}"
        )

        resumes = self.resume_repo.find_by_user(interview["candidate_id"])
        resume_text = resumes[0].get("raw_text", "") if resumes else ""

        questions_raw = interview.get("questions") or []
        expected_questions = svc.series_expected_questions(interview)
        merged_transcript = svc.merged_series_transcript(interview)

        try:
            state = await report_graph.ainvoke(
                {
                    "job_description": job_text[:3000],
                    "resume_content": resume_text[:3000],
                    "transcript": merged_transcript,
                    "expected_question_count": expected_questions,
                    "overall_score": 0,
                    "technical_score": 0,
                    "communication_score": 0,
                    "cultural_fit_score": 0,
                    "summary": "",
                    "strengths": [],
                    "areas_for_improvement": [],
                    "recommendation": "No Hire",
                }
            )

            return self.repo.update(
                report_id,
                {
                    "overall_score": state["overall_score"],
                    "technical_score": state["technical_score"],
                    "communication_score": state["communication_score"],
                    "cultural_fit_score": state["cultural_fit_score"],
                    "summary": state["summary"],
                    "strengths": state["strengths"],
                    "areas_for_improvement": state["areas_for_improvement"],
                    "recommendation": state["recommendation"],
                    "status": "ready",
                },
            )
        except Exception:
            from app.agents.report_agent import heuristic_report

            fallback = heuristic_report(
                {
                    "job_description": job_text[:3000],
                    "resume_content": resume_text[:3000],
                    "transcript": merged_transcript,
                    "expected_question_count": expected_questions,
                }
            )
            return self.repo.update(
                report_id,
                {**fallback, "status": "ready"},
            )
