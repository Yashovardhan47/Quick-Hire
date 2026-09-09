import re
from collections import defaultdict

from app.services.ai_policy import safe_requirements

MODEL_VERSION = "structured-interview-0.2.0"
NOTICE = (
    "This mock interview evaluates typed answer content against disclosed job-related criteria. "
    "It does not analyze face, voice, accent, emotion, personality, disability or honesty, and it cannot make a hiring decision."
)


def build_interview(requirements: list[dict], limit: int = 5) -> list[dict]:
    ordered = sorted(safe_requirements(requirements), key=lambda item: -float(item.get("weight", 1.0)))
    questions = []
    for index, requirement in enumerate(ordered[:limit], start=1):
        competency = str(requirement.get("name", "")).strip()
        questions.append(
            {
                "id": f"q{index}",
                "competency": competency,
                "prompt": (
                    f"Tell us about a specific situation where you used {competency}. "
                    "Explain the task, your actions, trade-offs, and a measurable result."
                ),
                "evaluation_criteria": [
                    "specific context and responsibility",
                    "job-related action and reasoning",
                    "measurable or observable result",
                    "reflection or trade-off",
                ],
                "rubric_terms": {
                    "context": ["situation", "context", "project", "team", "customer", "problem"],
                    "action": ["i built", "i designed", "i analyzed", "i implemented", "i led", "i tested", "i chose"],
                    "result": ["result", "improved", "reduced", "increased", "delivered", "%", "metric"],
                    "reflection": ["trade-off", "learned", "next time", "because", "decision", "alternative"],
                },
            }
        )
    return questions


def public_questions(questions: list[dict]) -> list[dict]:
    fields = {"id", "competency", "prompt", "evaluation_criteria"}
    return [{key: value for key, value in question.items() if key in fields} for question in questions]


def _criterion_score(answer: str, terms: list[str]) -> float:
    lowered = answer.lower()
    return 1.0 if any(term in lowered for term in terms) else 0.0


def score_interview(questions: list[dict], answers: dict[str, str]) -> dict:
    competency_points: dict[str, list[float]] = defaultdict(list)
    feedback = []

    for question in questions:
        answer = answers.get(question["id"], "").strip()
        criterion_scores = {
            criterion: _criterion_score(answer, terms)
            for criterion, terms in question["rubric_terms"].items()
        }
        completeness = min(1.0, len(re.findall(r"\b\w+\b", answer)) / 80.0)
        content_score = (sum(criterion_scores.values()) / 4.0) * 0.8 + completeness * 0.2
        competency_points[question["competency"]].append(content_score)
        missing = [name for name, value in criterion_scores.items() if value == 0]
        if not answer:
            feedback.append(f"{question['competency']}: no answer was submitted.")
        elif missing:
            feedback.append(
                f"{question['competency']}: make the {', '.join(missing)} more explicit and keep claims measurable."
            )
        else:
            feedback.append(f"{question['competency']}: the answer covers all disclosed structure criteria; verify its claims with a human reviewer.")

    rubric_scores = {
        competency: round(100.0 * sum(points) / len(points), 1)
        for competency, points in competency_points.items()
    }
    content_score = sum(rubric_scores.values()) / len(rubric_scores) if rubric_scores else 0.0
    return {
        "content_score": round(content_score, 1),
        "rubric_scores": rubric_scores,
        "feedback": feedback,
        "human_review_required": True,
    }
