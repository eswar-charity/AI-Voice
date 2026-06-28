"""
Interview question generation and turn-by-turn agent.
Three rounds per session: HR → Technical → Manager, each with tailored questions.
"""
import json
import re
from typing import TypedDict, List, Any, Optional

from langgraph.graph import StateGraph, END
from openai import AsyncOpenAI

from app.core.config import settings
from app.core.interview_rounds import (
    ROUND_DEFINITIONS,
    build_round_plan,
    flatten_questions,
    is_round_plan,
    locate_question,
    total_questions,
    transition_text,
    legacy_questions_to_plan,
)

FALLBACK_QUESTIONS = [
    "Tell me about yourself and what interests you about this role.",
    "Walk me through a challenging technical problem you solved recently.",
    "Which skills from your resume are most relevant to this position?",
    "How do you approach learning new technologies under tight deadlines?",
    "Describe a time you led a project or mentored someone on your team.",
    "What motivates you in your day-to-day work?",
    "How do you prioritize when multiple stakeholders need your attention?",
    "Do you have any questions about the team or the role?",
]

ROUND_GEN_PROMPT = """You are an expert interviewer planning a three-round interview:
1. HR Round — motivation, communication, culture fit
2. Technical Round — skills, problem-solving, hands-on experience from resume vs JD
3. Manager Round — leadership, ownership, strategic thinking, long-term fit

For each round, generate the exact number of questions requested. Each question must reference
something specific from the job description or resume when possible.

Return ONLY valid JSON:
{
  "hr": ["<question 1>", "<question 2>"],
  "technical": ["<q1>", "<q2>", "<q3>"],
  "manager": ["<q1>", "<q2>"]
}
"""


class InterviewTurnState(TypedDict):
    job_description: str
    resume_content: str
    round_type: str
    questions: Any
    transcript: List[Any]
    candidate_answer: str
    ai_response: str
    is_complete: bool
    round_transition: bool
    round_meta: dict


def _count_candidate_turns(transcript: List[Any]) -> int:
    return sum(1 for t in transcript if t.get("role") == "candidate")


def _normalize_plan(raw: Any) -> dict:
    if is_round_plan(raw):
        return raw
    if isinstance(raw, list) and raw:
        plan = legacy_questions_to_plan(raw)
        if plan:
            return plan
    return {}


def _rounds_from_plan(plan: dict) -> List[dict]:
    return plan.get("rounds") or []


def _extract_requirements(job_description: str) -> List[str]:
    tokens = [
        t.strip()
        for t in re.split(r"[,;/|\n]+", job_description)
        if len(t.strip()) >= 2
    ]
    seen: set[str] = set()
    out: List[str] = []
    for t in tokens:
        key = t.lower()
        if key not in seen and not key.startswith("title:") and key not in ("requirements", "company"):
            seen.add(key)
            out.append(t.strip())
    return out[:12]


def _extract_job_title(job_description: str) -> str:
    match = re.search(r"Title:\s*(.+)", job_description, re.I)
    return match.group(1).strip() if match else "this role"


def _heuristic_round_questions(
    round_def: dict,
    job_description: str,
    resume_content: str,
    parsed_content: Optional[dict] = None,
) -> List[str]:
    parsed = parsed_content or {}
    title = _extract_job_title(job_description)
    requirements = _extract_requirements(job_description)
    resume_lower = resume_content.lower()
    parsed_skills = [str(s) for s in (parsed.get("skills") or []) if s]
    matched = [r for r in requirements if r.lower() in resume_lower]
    matched += [s for s in parsed_skills if s.lower() in job_description.lower()]
    matched = list(dict.fromkeys(matched))[:4]
    gaps = [r for r in requirements if r.lower() not in resume_lower][:2]
    count = round_def["question_count"]
    rid = round_def["id"]

    if rid == "hr":
        pool = [
            f"Tell me about yourself and why you're interested in the {title} role.",
            "How would you describe your communication style when working with different teams?",
            "What kind of work environment helps you do your best work?",
            "What are you hoping to grow into over the next couple of years?",
        ]
    elif rid == "technical":
        pool = []
        for skill in matched[:2]:
            pool.append(
                f"Your background mentions {skill}. Walk me through a project where you used it in depth."
            )
        for gap in gaps[:1]:
            pool.append(
                f"This role emphasizes {gap}. How have you worked with that, and how would you ramp up if needed?"
            )
        pool.extend(
            [
                "Describe a technical problem you solved recently — what was your approach?",
                "Which requirement from the job description aligns best with your experience?",
                "How do you validate your work before shipping to production or stakeholders?",
            ]
        )
    else:
        pool = [
            "Tell me about a time you took ownership beyond your formal responsibilities.",
            "How do you handle disagreement with a teammate or stakeholder on direction?",
            "What would success look like for you in this role in the first six months?",
            "Why should we choose you over other strong candidates for this position?",
        ]

    pool = list(dict.fromkeys(q for q in pool if q))
    while len(pool) < count:
        filler = FALLBACK_QUESTIONS[len(pool) % len(FALLBACK_QUESTIONS)]
        if filler not in pool:
            pool.append(filler)
        else:
            break
    return pool[:count]


def _build_rounds_with_questions(
    job_description: str,
    resume_content: str,
    parsed_content: Optional[dict] = None,
    ai_rounds: Optional[dict] = None,
) -> List[dict]:
    rounds: List[dict] = []
    for rd in ROUND_DEFINITIONS:
        entry = {k: v for k, v in rd.items()}
        if ai_rounds and rd["id"] in ai_rounds:
            qs = [q.strip() for q in ai_rounds[rd["id"]] if q and str(q).strip()]
            if len(qs) >= rd["question_count"]:
                entry["questions"] = qs[: rd["question_count"]]
            else:
                entry["questions"] = _heuristic_round_questions(
                    rd, job_description, resume_content, parsed_content
                )
        else:
            entry["questions"] = _heuristic_round_questions(
                rd, job_description, resume_content, parsed_content
            )
        rounds.append(entry)
    return rounds


async def generate_single_round_plan(
    round_type: str,
    job_description: str,
    resume_content: str,
    parsed_content: Optional[dict] = None,
) -> dict:
    """Generate questions for one interview session (one round only)."""
    from app.core.interview_rounds import get_round_def

    rd = get_round_def(round_type)
    questions = _heuristic_round_questions(rd, job_description, resume_content, parsed_content)

    if settings.OPENAI_API_KEY and resume_content.strip():
        try:
            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, max_retries=0)
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                response_format={"type": "json_object"},
                temperature=0.35,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            f"You are planning the {rd['label']} of a job interview. "
                            f"Focus: {rd.get('focus', '')}. "
                            f"Generate exactly {rd['question_count']} tailored questions. "
                            'Return ONLY JSON: {"questions": ["...", "..."]}'
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"JOB DESCRIPTION:\n{job_description[:3000]}\n\n"
                            f"RESUME:\n{resume_content[:3000]}"
                        ),
                    },
                ],
            )
            result = json.loads(response.choices[0].message.content)
            ai_qs = [q.strip() for q in (result.get("questions") or []) if q and str(q).strip()]
            if len(ai_qs) >= rd["question_count"]:
                questions = ai_qs[: rd["question_count"]]
        except Exception:
            pass

    entry = {k: v for k, v in rd.items()}
    entry["questions"] = questions
    return build_round_plan([entry])


async def generate_interview_rounds(
    job_description: str,
    resume_content: str,
    parsed_content: Optional[dict] = None,
) -> dict:
    ai_rounds: Optional[dict] = None
    if settings.OPENAI_API_KEY and resume_content.strip():
        try:
            counts = ", ".join(
                f"{r['id']}: {r['question_count']} questions" for r in ROUND_DEFINITIONS
            )
            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, max_retries=0)
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                response_format={"type": "json_object"},
                temperature=0.35,
                messages=[
                    {"role": "system", "content": ROUND_GEN_PROMPT},
                    {
                        "role": "user",
                        "content": (
                            f"Generate exactly these counts — {counts}.\n\n"
                            f"JOB DESCRIPTION:\n{job_description[:3000]}\n\n"
                            f"RESUME:\n{resume_content[:3000]}"
                        ),
                    },
                ],
            )
            ai_rounds = json.loads(response.choices[0].message.content)
        except Exception:
            pass

    rounds = _build_rounds_with_questions(
        job_description, resume_content, parsed_content, ai_rounds
    )
    return build_round_plan(rounds)


# Backward-compatible flat list helper
async def generate_interview_questions(
    job_description: str,
    resume_content: str,
    parsed_content: Optional[dict] = None,
) -> List[str]:
    plan = await generate_interview_rounds(job_description, resume_content, parsed_content)
    return flatten_questions(plan["rounds"])


def _next_question_payload(plan: dict, turns: int) -> tuple[str, bool, dict]:
    """After `turns` candidate answers, build the next interviewer line."""
    rounds = _rounds_from_plan(plan)
    flat = flatten_questions(rounds)
    required = len(flat)
    from app.core.interview_rounds import round_meta_for_answer_count

    if turns >= required:
        if len(rounds) == 1:
            label = rounds[0].get("label", "this round")
            closing = (
                f"Thank you for completing the {label}. "
                "Take your time to prepare — when you're ready, return to AI Interviews to start the next round. Best of luck!"
            )
        else:
            closing = (
                "Thank you for sharing your thoughts across all three rounds today. "
                "That concludes our interview — we'll be in touch soon. Best of luck!"
            )
        meta = round_meta_for_answer_count(rounds, max(0, required - 1))
        return closing, True, meta

    next_idx = turns
    ri, qi = locate_question(rounds, next_idx)
    next_q = flat[next_idx]
    meta = round_meta_for_answer_count(rounds, turns)
    round_transition = qi == 0 and ri > 0

    prefix = ""
    if round_transition:
        prefix = transition_text(rounds[ri - 1], rounds[ri])

    return f"{prefix}{next_q}", False, {**meta, "round_transition": round_transition}


def _build_turn_prompt(plan: dict) -> str:
    rounds = _rounds_from_plan(plan)
    flat = flatten_questions(rounds)
    required = len(flat)
    round_desc = "\n".join(
        f"- {r['label']}: {len(r.get('questions') or [])} questions ({r.get('focus', '')})"
        for r in rounds
    )
    return f"""You are conducting a multi-round voice interview. Respond as the current round's interviewer.

Rounds:
{round_desc}

Rules:
- There are exactly {required} prepared questions across all rounds — ask ALL before ending
- When starting a new round, briefly welcome the candidate to that round (HR → Technical → Manager)
- If fewer than {required} candidate answers recorded, ask the next prepared question
- Only after {required} candidate answers, set is_complete to true with a warm closing
- Keep responses under 3 sentences — this is voice, not text
- Do not repeat a question already asked

Return ONLY valid JSON:
{{
  "ai_response": "<what the interviewer says next>",
  "is_complete": <true|false>,
  "round_transition": <true|false>
}}
"""


def _enforce_minimum_turns(
    state: InterviewTurnState, is_complete: bool, ai_response: str, round_transition: bool
) -> InterviewTurnState:
    plan = _normalize_plan(state["questions"])
    if not plan:
        plan = build_round_plan(
            _build_rounds_with_questions(state["job_description"], state["resume_content"])
        )

    turns = _count_candidate_turns(state["transcript"])
    canonical, must_complete, meta = _next_question_payload(plan, turns)

    if must_complete:
        closing = ai_response if is_complete and ai_response else canonical
        return {
            **state,
            "questions": plan,
            "ai_response": closing,
            "is_complete": True,
            "round_transition": False,
            "round_meta": meta,
        }

    if meta.get("round_transition"):
        return {
            **state,
            "questions": plan,
            "ai_response": canonical,
            "is_complete": False,
            "round_transition": True,
            "round_meta": meta,
        }

    flat = flatten_questions(_rounds_from_plan(plan))
    next_q = flat[turns]
    if next_q.lower() in (ai_response or "").lower():
        final = ai_response
    else:
        ack = (ai_response or "Thanks for that.").split(".")[0] + "."
        final = f"{ack} {next_q}"

    return {
        **state,
        "questions": plan,
        "ai_response": final,
        "is_complete": False,
        "round_transition": False,
        "round_meta": meta,
    }


def _fallback_turn(state: InterviewTurnState) -> InterviewTurnState:
    plan = _normalize_plan(state["questions"])
    if not plan:
        plan = build_round_plan(_build_rounds_with_questions(state["job_description"], state["resume_content"]))

    turns = _count_candidate_turns(state["transcript"])
    answer = state["candidate_answer"].strip()
    text, is_complete, meta = _next_question_payload(plan, turns)

    if not is_complete and answer:
        ack = "Thanks for that."
        if meta.get("round_transition"):
            ri = meta.get("round_index", 0)
            rounds = _rounds_from_plan(plan)
            if ri > 0:
                text = transition_text(rounds[ri - 1], rounds[ri]) + flatten_questions(rounds)[turns]
            else:
                text = f"{ack} {flatten_questions(rounds)[turns]}"
        else:
            flat = flatten_questions(_rounds_from_plan(plan))
            text = f"{ack} {flat[turns]}" if turns < len(flat) else text

    return {
        **state,
        "questions": plan,
        "ai_response": text,
        "is_complete": is_complete,
        "round_transition": bool(meta.get("round_transition")),
        "round_meta": meta,
    }


async def generate_questions(state: InterviewTurnState) -> InterviewTurnState:
    plan = _normalize_plan(state["questions"])
    if plan:
        return {**state, "questions": plan}
    round_type = state.get("round_type") or "hr"
    plan = await generate_single_round_plan(
        round_type,
        state["job_description"],
        state["resume_content"],
    )
    return {**state, "questions": plan}


async def conduct_turn(state: InterviewTurnState) -> InterviewTurnState:
    plan = _normalize_plan(state["questions"])
    if not plan:
        round_type = state.get("round_type") or "hr"
        plan = await generate_single_round_plan(
            round_type,
            state["job_description"],
            state["resume_content"],
        )

    rounds = _rounds_from_plan(plan)
    flat = flatten_questions(rounds)
    required = len(flat)

    if settings.OPENAI_API_KEY:
        try:
            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, max_retries=0)
            transcript_text = "\n".join(
                f"{t['role'].upper()}: {t['content']}" for t in state["transcript"]
            )
            questions_text = "\n".join(
                f"{i + 1}. [{rounds[ri]['label']}] {q}"
                for i, q in enumerate(flat)
                for ri, _ in [locate_question(rounds, i)]
            )

            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                response_format={"type": "json_object"},
                temperature=0.4,
                messages=[
                    {"role": "system", "content": _build_turn_prompt(plan)},
                    {
                        "role": "user",
                        "content": (
                            f"PREPARED QUESTIONS ({required} total):\n{questions_text}\n\n"
                            f"CANDIDATE ANSWERS SO FAR: {_count_candidate_turns(state['transcript'])}\n\n"
                            f"CONVERSATION SO FAR:\n{transcript_text}\n\n"
                            f"CANDIDATE JUST SAID: {state['candidate_answer']}"
                        ),
                    },
                ],
            )
            result = json.loads(response.choices[0].message.content)
            return _enforce_minimum_turns(
                {**state, "questions": plan},
                bool(result.get("is_complete", False)),
                result.get("ai_response", "Thank you. Let's move on."),
                bool(result.get("round_transition", False)),
            )
        except Exception:
            pass

    return _fallback_turn({**state, "questions": plan})


def build_interview_graph():
    g = StateGraph(InterviewTurnState)
    g.add_node("prepare", generate_questions)
    g.add_node("respond", conduct_turn)
    g.set_entry_point("prepare")
    g.add_edge("prepare", "respond")
    g.add_edge("respond", END)
    return g.compile()


interview_graph = build_interview_graph()
