"""
LangGraph agent that generates a final evaluation report from an interview transcript.
Falls back to heuristic scoring when OpenAI is unavailable.
"""
import json
import re
from typing import TypedDict, List, Any

from langgraph.graph import StateGraph, END
from openai import AsyncOpenAI

from app.core.config import settings

MIN_INTERVIEW_TURNS = 4  # fallback minimum when question list unavailable

REPORT_PROMPT = """You are a senior HR analyst. Based on the interview transcript, job description,
and candidate's resume, generate a comprehensive evaluation report.

Return ONLY valid JSON:
{
  "overall_score": <0-100>,
  "technical_score": <0-100>,
  "communication_score": <0-100>,
  "cultural_fit_score": <0-100>,
  "summary": "<3-4 sentence narrative summary of the candidate's performance>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "areas_for_improvement": ["<area 1>", "<area 2>"],
  "recommendation": "<Strong Hire|Hire|No Hire>"
}

Scoring guide:
- technical_score: depth of technical knowledge demonstrated
- communication_score: clarity, structure, confidence of responses
- cultural_fit_score: alignment with role type, enthusiasm, professionalism
- overall_score: weighted average (technical 40%, communication 35%, cultural 25%)
- Score 0 only if the candidate did not answer any questions
"""


class ReportState(TypedDict):
    job_description: str
    resume_content: str
    transcript: List[Any]
    expected_question_count: int
    overall_score: int
    technical_score: int
    communication_score: int
    cultural_fit_score: int
    summary: str
    strengths: List[str]
    areas_for_improvement: List[str]
    recommendation: str


def _candidate_answers(transcript: List[Any]) -> List[str]:
    return [
        t.get("content", "")
        for t in transcript
        if t.get("role") == "candidate" and t.get("content")
    ]


def heuristic_report(state: ReportState) -> dict:
    answers = _candidate_answers(state["transcript"])
    num_answers = len(answers)
    expected = state.get("expected_question_count") or 4

    if num_answers == 0:
        return {
            "overall_score": 0,
            "technical_score": 0,
            "communication_score": 0,
            "cultural_fit_score": 0,
            "summary": "The candidate did not complete any interview responses.",
            "strengths": [],
            "areas_for_improvement": ["Complete the full interview to receive an evaluation"],
            "recommendation": "No Hire",
        }

    avg_words = sum(len(a.split()) for a in answers) / num_answers
    job_lower = state["job_description"].lower()
    resume_lower = state["resume_content"].lower()

    technical_hits = 0
    for answer in answers:
        tokens = set(re.findall(r"[a-z0-9+#.]{3,}", answer.lower()))
        job_tokens = set(re.findall(r"[a-z0-9+#.]{3,}", job_lower))
        resume_tokens = set(re.findall(r"[a-z0-9+#.]{3,}", resume_lower))
        if tokens & job_tokens:
            technical_hits += 1
        if tokens & resume_tokens:
            technical_hits += 1

    participation_score = min(35, num_answers * 7)
    depth_score = min(30, int(avg_words * 1.5))
    relevance_score = min(25, technical_hits * 5)
    base = min(92, 35 + participation_score + depth_score + relevance_score)

    technical = min(95, base + (5 if technical_hits >= num_answers else 0))
    communication = min(95, int(base + min(15, avg_words - 10)))
    cultural = min(95, base)
    overall = int(technical * 0.4 + communication * 0.35 + cultural * 0.25)

    if num_answers < expected:
        overall = max(0, overall - (expected - num_answers) * 8)
        summary = (
            f"The candidate answered {num_answers} of {expected} tailored questions. "
            f"Responses averaged {avg_words:.0f} words. "
            "Complete more interview questions for a fuller evaluation."
        )
        recommendation = "No Hire" if overall < 50 else "Hire"
    else:
        summary = (
            f"The candidate completed {num_answers} interview questions with responses "
            f"averaging {avg_words:.0f} words. "
            "Evaluation based on participation depth and relevance to the role."
        )
        if overall >= 75:
            recommendation = "Strong Hire"
        elif overall >= 55:
            recommendation = "Hire"
        else:
            recommendation = "No Hire"

    strengths = []
    if avg_words >= 30:
        strengths.append("Provided detailed, thoughtful answers")
    if num_answers >= expected:
        strengths.append("Completed the full interview")
    if technical_hits >= 2:
        strengths.append("Demonstrated role-relevant knowledge")
    if not strengths:
        strengths = ["Participated in the interview process"]

    improvements = []
    if num_answers < expected:
        improvements.append(f"Answer all {expected} tailored interview questions")
    if avg_words < 20:
        improvements.append("Provide more detailed responses with specific examples")
    if not improvements:
        improvements = ["Continue building depth in technical examples"]

    return {
        "overall_score": overall,
        "technical_score": technical,
        "communication_score": communication,
        "cultural_fit_score": cultural,
        "summary": summary,
        "strengths": strengths[:3],
        "areas_for_improvement": improvements[:2],
        "recommendation": recommendation,
    }


async def generate_report(state: ReportState) -> ReportState:
    if settings.OPENAI_API_KEY:
        try:
            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, max_retries=0)
            transcript_text = "\n".join(
                f"{t['role'].upper()}: {t['content']}" for t in state["transcript"]
            )

            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                response_format={"type": "json_object"},
                temperature=0,
                messages=[
                    {"role": "system", "content": REPORT_PROMPT},
                    {
                        "role": "user",
                        "content": (
                            f"JOB DESCRIPTION:\n{state['job_description']}\n\n"
                            f"RESUME:\n{state['resume_content']}\n\n"
                            f"INTERVIEW TRANSCRIPT:\n{transcript_text}"
                        ),
                    },
                ],
            )

            result = json.loads(response.choices[0].message.content)
            overall = int(result.get("overall_score", 0))
            if overall > 0:
                return {
                    **state,
                    "overall_score": overall,
                    "technical_score": int(result.get("technical_score", 0)),
                    "communication_score": int(result.get("communication_score", 0)),
                    "cultural_fit_score": int(result.get("cultural_fit_score", 0)),
                    "summary": result.get("summary", ""),
                    "strengths": result.get("strengths", []),
                    "areas_for_improvement": result.get("areas_for_improvement", []),
                    "recommendation": result.get("recommendation", "No Hire"),
                }
        except Exception:
            pass

    result = heuristic_report(state)
    return {**state, **result}


def build_report_graph():
    g = StateGraph(ReportState)
    g.add_node("report", generate_report)
    g.set_entry_point("report")
    g.add_edge("report", END)
    return g.compile()


report_graph = build_report_graph()
