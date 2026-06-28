"""
Multi-round interview structure for a single candidate session.

HR → Technical → Manager, each with a distinct ElevenLabs premade voice (free tier).
"""
from typing import Any, List, Optional, Tuple

# ElevenLabs premade voice IDs (available on free tier)
VOICE_BELLA = "EXAVITQu4vr4xnSDxMaL"   # friendly female
VOICE_RACHEL = "21m00Tcm4TlvDq8ikWAM"  # warm professional female
VOICE_DOMI = "AZnzlk1XvdvUeBnXmlld"     # professional neutral
VOICE_ADAM = "pNInz6obpgDQGcFmaJgB"    # confident senior male

ROUND_ORDER = ["hr", "technical", "manager"]


def get_round_def(round_type: str) -> dict:
    for r in ROUND_DEFINITIONS:
        if r["id"] == round_type:
            return r
    return ROUND_DEFINITIONS[0]


def next_round_type(current: str) -> Optional[str]:
    try:
        idx = ROUND_ORDER.index(current)
    except ValueError:
        return None
    return ROUND_ORDER[idx + 1] if idx + 1 < len(ROUND_ORDER) else None


def is_final_round(round_type: str) -> bool:
    return round_type == ROUND_ORDER[-1]


def round_sort_key(round_type: str) -> int:
    try:
        return ROUND_ORDER.index(round_type)
    except ValueError:
        return 99


ROUND_DEFINITIONS: List[dict] = [
    {
        "id": "hr",
        "label": "HR Round",
        "voice_id": VOICE_BELLA,
        "voice_name": "Bella",
        "interviewer_title": "HR Partner",
        "tone": "warm, friendly, and encouraging",
        "focus": "motivation, communication, culture fit, and career goals",
        "question_count": 2,
    },
    {
        "id": "technical",
        "label": "Technical Round",
        "voice_id": VOICE_DOMI,
        "voice_name": "Domi",
        "interviewer_title": "Technical Interviewer",
        "tone": "professional, clear, and precise",
        "focus": "technical skills, problem-solving, and hands-on experience from the resume and JD",
        "question_count": 3,
    },
    {
        "id": "manager",
        "label": "Manager Round",
        "voice_id": VOICE_ADAM,
        "voice_name": "Adam",
        "interviewer_title": "Hiring Manager",
        "tone": "confident, senior, and strategic",
        "focus": "leadership, ownership, long-term fit, and decision-making",
        "question_count": 2,
    },
]


def is_round_plan(data: Any) -> bool:
    return isinstance(data, dict) and data.get("format") == "multi_round" and "rounds" in data


def flatten_questions(rounds: List[dict]) -> List[str]:
    out: List[str] = []
    for r in rounds:
        out.extend(r.get("questions") or [])
    return out


def total_questions(rounds: List[dict]) -> int:
    return len(flatten_questions(rounds))


def locate_question(rounds: List[dict], flat_index: int) -> Tuple[int, int]:
    """Map flat question index → (round_index, question_index_in_round)."""
    cursor = 0
    for ri, r in enumerate(rounds):
        qs = r.get("questions") or []
        for qi, _ in enumerate(qs):
            if cursor == flat_index:
                return ri, qi
            cursor += 1
    return len(rounds) - 1, 0


def round_for_answer_count(rounds: List[dict], candidate_answers: int) -> dict:
    """Which round the *next* question belongs to (0-based answer count so far)."""
    if candidate_answers <= 0:
        return rounds[0]
    flat_next = min(candidate_answers, total_questions(rounds) - 1)
    ri, _ = locate_question(rounds, flat_next)
    return rounds[ri]


def voice_for_answer_count(rounds: List[dict], candidate_answers: int) -> str:
    return round_for_answer_count(rounds, candidate_answers).get("voice_id", VOICE_BELLA)


def round_meta_for_answer_count(rounds: List[dict], candidate_answers: int) -> dict:
    r = round_for_answer_count(rounds, candidate_answers)
    ri, qi = locate_question(rounds, min(candidate_answers, max(0, total_questions(rounds) - 1)))
    return {
        "round_id": r.get("id"),
        "round_label": r.get("label"),
        "round_index": ri,
        "round_question_index": qi,
        "voice_id": r.get("voice_id"),
        "voice_name": r.get("voice_name"),
        "interviewer_title": r.get("interviewer_title"),
        "total_rounds": len(rounds),
    }


def transition_text(prev_round: dict, next_round: dict) -> str:
    return (
        f"Thank you — that completes our {prev_round['label']}. "
        f"Welcome to the {next_round['label']}. I'm {next_round['voice_name']}, your {next_round['interviewer_title']}. "
    )


def build_round_plan(rounds_with_questions: List[dict]) -> dict:
    return {
        "format": "multi_round",
        "rounds": rounds_with_questions,
        "total_questions": total_questions(rounds_with_questions),
    }


def legacy_questions_to_plan(questions: list) -> Optional[dict]:
    if not questions or is_round_plan(questions):
        return questions if is_round_plan(questions) else None
    if isinstance(questions, list):
        # Migrate flat list into single pseudo technical round for old sessions
        return build_round_plan(
            [
                {
                    **ROUND_DEFINITIONS[1],
                    "questions": questions,
                }
            ]
        )
    return None
