"""
LangGraph agent that scores a resume against a job description.
Falls back to local heuristic scoring when OpenAI is unavailable.
"""
import json
import re
from typing import TypedDict, List, Optional, Set

from langgraph.graph import StateGraph, END
from openai import AsyncOpenAI

from app.core.config import settings

SYSTEM_PROMPT = """You are a senior technical recruiter. Given a resume and a job description,
score how well the candidate matches the role.

Return ONLY valid JSON with this exact shape:
{
  "score": <integer 0-100>,
  "reasoning": "<2-3 sentence explanation of the overall match>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "weaknesses": ["<gap 1>", "<gap 2>"]
}

Scoring rubric:
90-100: Exceptional fit — exceeds most requirements
70-89:  Strong fit — meets core requirements with minor gaps
50-69:  Moderate fit — meets some requirements, notable gaps
30-49:  Weak fit — significant skill gaps
0-29:   Poor fit — most requirements unmet
"""

_STOPWORDS = {
    "a", "an", "the", "and", "or", "for", "to", "of", "in", "on", "with",
    "is", "are", "was", "be", "at", "by", "as", "from", "that", "this",
    "will", "have", "has", "had", "not", "you", "your", "we", "our", "they",
    "title", "company", "requirements", "description", "role", "job", "work",
}

_COMMON_SKILLS = (
    "python", "javascript", "typescript", "react", "node", "nodejs", "fastapi",
    "django", "flask", "sql", "postgres", "postgresql", "mongodb", "aws", "azure",
    "gcp", "docker", "kubernetes", "java", "golang", "go", "rust", "c++", "c#",
    ".net", "machine learning", "deep learning", "nlp", "llm", "openai", "langchain",
    "langgraph", "data science", "tensorflow", "pytorch", "git", "ci/cd", "rest",
    "graphql", "redis", "kafka", "spark", "html", "css", "vue", "angular", "nextjs",
    "next.js", "express", "spring", "hibernate", "terraform", "ansible", "linux",
    "agile", "scrum", "api", "microservices", "supabase", "firebase",
)


class MatchState(TypedDict):
    resume_content: str
    job_description: str
    parsed_content: Optional[dict]
    score: int
    reasoning: str
    strengths: List[str]
    weaknesses: List[str]


def _extract_requirements_block(job_description: str) -> str:
    match = re.search(r"requirements:\s*(.+)", job_description, re.I | re.S)
    if match:
        return match.group(1).strip()
    return job_description


def _skill_tokens(text: str) -> Set[str]:
    lower = text.lower()
    found = {s for s in _COMMON_SKILLS if s in lower}
    for token in re.findall(r"[a-z0-9+#.]{2,}", lower):
        if token in _STOPWORDS or len(token) < 3:
            continue
        if token in _COMMON_SKILLS:
            found.add(token)
    return found


def build_match_reasoning(
    score: int,
    strengths: List[str],
    weaknesses: List[str],
    *,
    matched_skills: Optional[List[str]] = None,
) -> str:
    """Recruiter-facing summary — no internal fallback or provider details."""
    if score >= 70:
        opener = "This candidate appears to be a strong fit for the role."
    elif score >= 50:
        opener = "This candidate shows moderate alignment with the role requirements."
    elif score >= 30:
        opener = "This candidate has limited overlap with the role requirements."
    else:
        opener = "This candidate appears to be a weak fit for the role."

    parts = [opener]
    skills = matched_skills or []
    if skills:
        parts.append(f"Relevant skills include {', '.join(skills[:4])}.")
    if strengths:
        s = strengths[0].rstrip(".")
        parts.append(f"{s}.")
    if weaknesses:
        w = weaknesses[0].rstrip(".")
        parts.append(f"{w}.")
    return " ".join(parts)


_INTERNAL_REASONING_MARKERS = (
    "heuristic match",
    "local match analysis",
    "local analysis",
    "ai scoring was unavailable",
    "openai scoring was unavailable",
    "re-run matching",
    "requirement hits",
    "skill alignment",
    "keyword overlap",
    "matching failed:",
)


def sanitize_match_reasoning(
    reasoning: str,
    score: int = 0,
    strengths: Optional[List[str]] = None,
    weaknesses: Optional[List[str]] = None,
) -> str:
    """Strip internal fallback text from stored reasoning (legacy rows)."""
    text = (reasoning or "").strip()
    lower = text.lower()
    if not text or any(marker in lower for marker in _INTERNAL_REASONING_MARKERS):
        return build_match_reasoning(
            score,
            strengths or [],
            weaknesses or [],
        )
    return text


def _requirement_phrases(requirements_text: str) -> List[str]:
    phrases: List[str] = []
    for part in re.split(r"[,;/|\n•\-]+", requirements_text):
        cleaned = part.strip().lower()
        if len(cleaned) < 2 or cleaned in _STOPWORDS:
            continue
        if cleaned.startswith("title:") or cleaned.startswith("company:"):
            continue
        phrases.append(cleaned)
    return list(dict.fromkeys(phrases))


def heuristic_score(
    resume_content: str,
    job_description: str,
    parsed_content: Optional[dict] = None,
) -> dict:
    """Local fallback when OpenAI is unavailable (quota, network, etc.)."""
    parsed = parsed_content or {}
    resume_lower = resume_content.lower()
    requirements_text = _extract_requirements_block(job_description)
    job_lower = job_description.lower()

    parsed_skills = [str(s).lower() for s in (parsed.get("skills") or []) if s]
    resume_skills = _skill_tokens(resume_content) | set(parsed_skills)
    job_skills = _skill_tokens(job_description)

    matched_skills = sorted(resume_skills & job_skills)
    skill_ratio = len(matched_skills) / max(len(job_skills), 1)

    requirement_phrases = _requirement_phrases(requirements_text)
    matched_requirements = [p for p in requirement_phrases if p in resume_lower]

    job_terms = {
        w for w in re.findall(r"[a-z0-9+#.]{3,}", job_lower)
        if w not in _STOPWORDS
    }
    resume_terms = {
        w for w in re.findall(r"[a-z0-9+#.]{3,}", resume_lower)
        if w not in _STOPWORDS
    }
    overlap_ratio = len(job_terms & resume_terms) / max(len(job_terms), 1)

    experience = parsed.get("experience") or []
    experience_bonus = min(12, len(experience) * 4)

    # Weighted score — no artificial floor; reflects actual alignment
    skill_points = min(40, int(skill_ratio * 40) + len(matched_skills) * 4)
    req_points = min(35, len(matched_requirements) * 12)
    overlap_points = int(overlap_ratio * 25)
    score = min(98, skill_points + req_points + overlap_points + experience_bonus)

    # Penalize very weak matches instead of clamping everyone to 40%
    if not matched_skills and not matched_requirements and overlap_ratio < 0.08:
        score = min(score, 28)
    elif overlap_ratio < 0.15 and len(matched_skills) < 2:
        score = min(score, 45)

    strengths: List[str] = []
    for s in matched_skills[:3]:
        strengths.append(f"Experience with {s}")
    for r in matched_requirements[:2]:
        if r not in strengths:
            strengths.append(f"Matches requirement: {r}")
    if not strengths and experience:
        titles = [
            e.get("title") for e in experience
            if isinstance(e, dict) and e.get("title")
        ]
        strengths = [f"Background as {t}" for t in titles[:2]]
    if not strengths:
        strengths = ["Resume addresses some aspects of the role"]

    weaknesses: List[str] = []
    missing_skills = sorted(job_skills - resume_skills)[:4]
    if missing_skills:
        weaknesses.append(f"May lack: {', '.join(missing_skills[:3])}")
    if len(matched_requirements) < max(1, len(requirement_phrases) // 2):
        weaknesses.append("Several listed requirements are not clearly demonstrated on the resume")
    if score < 50:
        weaknesses.append("Limited alignment with core job requirements")
    if not weaknesses:
        weaknesses = ["Minor gaps may exist in specialized requirements"]

    strengths = strengths[:3]
    weaknesses = weaknesses[:3]

    return {
        "score": score,
        "reasoning": build_match_reasoning(
            score,
            strengths,
            weaknesses,
            matched_skills=matched_skills,
        ),
        "strengths": strengths,
        "weaknesses": weaknesses,
    }


async def score_match(state: MatchState) -> MatchState:
    parsed = state.get("parsed_content")

    if settings.OPENAI_API_KEY:
        try:
            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, max_retries=0)
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                response_format={"type": "json_object"},
                temperature=0,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": (
                            f"RESUME:\n{state['resume_content']}\n\n"
                            f"JOB DESCRIPTION:\n{state['job_description']}"
                        ),
                    },
                ],
            )
            result = json.loads(response.choices[0].message.content)
            return {
                **state,
                "score": max(0, min(100, int(result.get("score", 0)))),
                "reasoning": result.get("reasoning", ""),
                "strengths": result.get("strengths", []),
                "weaknesses": result.get("weaknesses", []),
            }
        except Exception:
            pass

    result = heuristic_score(
        state["resume_content"],
        state["job_description"],
        parsed,
    )
    return {**state, **result}


def build_matching_graph():
    g = StateGraph(MatchState)
    g.add_node("evaluate", score_match)
    g.set_entry_point("evaluate")
    g.add_edge("evaluate", END)
    return g.compile()


matching_graph = build_matching_graph()
