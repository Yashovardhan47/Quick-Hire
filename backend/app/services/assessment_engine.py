from collections import defaultdict

from app.services.evidence_graph import normalize, skill_similarity


MODEL_VERSION = "adaptive-assessment-0.2.0"

QUESTION_BANK: list[dict] = [
    {
        "id": "python-mutable-default",
        "competency": "Python",
        "prompt": "Why should a mutable list usually not be used as a Python function's default argument?",
        "options": [
            "It is shared across calls and can retain prior mutations",
            "Python does not allow lists as function arguments",
            "It forces the function to run asynchronously",
            "It converts every value to a string",
        ],
        "answer": "It is shared across calls and can retain prior mutations",
        "difficulty": "applied",
        "explanation": "Default argument objects are created once when the function is defined.",
    },
    {
        "id": "sql-left-join",
        "competency": "SQL",
        "prompt": "Which join keeps every row from the left table even when no matching row exists on the right?",
        "options": ["LEFT JOIN", "INNER JOIN", "CROSS JOIN", "SELF JOIN"],
        "answer": "LEFT JOIN",
        "difficulty": "foundation",
        "explanation": "A LEFT JOIN preserves unmatched rows from the left-side relation.",
    },
    {
        "id": "statistics-confidence",
        "competency": "Statistics",
        "prompt": "What does a 95% confidence interval procedure mean under repeated sampling?",
        "options": [
            "About 95% of intervals built this way contain the true parameter",
            "There is a 95% chance every observed value lies inside this interval",
            "The sample mean is correct 95% of the time",
            "The null hypothesis has a 95% probability of being false",
        ],
        "answer": "About 95% of intervals built this way contain the true parameter",
        "difficulty": "applied",
        "explanation": "The confidence level describes long-run coverage of the interval-building procedure.",
    },
    {
        "id": "ml-data-leakage",
        "competency": "Machine learning",
        "prompt": "Which practice most directly prevents test-set information from leaking into model training?",
        "options": [
            "Fit preprocessing only on training folds inside the validation pipeline",
            "Increase the number of model parameters",
            "Shuffle target labels before training",
            "Evaluate repeatedly on the final test set",
        ],
        "answer": "Fit preprocessing only on training folds inside the validation pipeline",
        "difficulty": "applied",
        "explanation": "Preprocessing must be learned without access to validation or test observations.",
    },
    {
        "id": "ab-test-primary-metric",
        "competency": "A/B testing",
        "prompt": "Why should an experiment's primary metric be selected before looking at results?",
        "options": [
            "To reduce outcome switching and false-positive decisions",
            "To guarantee the treatment will win",
            "To remove the need for a sample-size calculation",
            "To make random assignment unnecessary",
        ],
        "answer": "To reduce outcome switching and false-positive decisions",
        "difficulty": "applied",
        "explanation": "Pre-specification limits selective reporting and supports valid inference.",
    },
    {
        "id": "fastapi-dependency",
        "competency": "FastAPI",
        "prompt": "What is FastAPI dependency injection commonly used for?",
        "options": [
            "Sharing request-scoped authentication and database logic",
            "Compiling Python into browser JavaScript",
            "Replacing every database query with a cache",
            "Creating CSS layouts",
        ],
        "answer": "Sharing request-scoped authentication and database logic",
        "difficulty": "foundation",
        "explanation": "Dependencies provide reusable request-scoped concerns such as identity and sessions.",
    },
    {
        "id": "react-stable-keys",
        "competency": "React",
        "prompt": "Why should list items use stable React keys?",
        "options": [
            "They let React preserve item identity across renders",
            "They encrypt component props",
            "They replace semantic HTML",
            "They make network requests synchronous",
        ],
        "answer": "They let React preserve item identity across renders",
        "difficulty": "foundation",
        "explanation": "Stable keys help reconciliation map previous and next list items correctly.",
    },
    {
        "id": "docker-image-layer",
        "competency": "Docker",
        "prompt": "Which change generally improves Docker build-cache reuse?",
        "options": [
            "Copy dependency manifests and install before copying frequently changed source",
            "Put every build step into one giant RUN command",
            "Disable layers for all builds",
            "Copy temporary files into the image first",
        ],
        "answer": "Copy dependency manifests and install before copying frequently changed source",
        "difficulty": "applied",
        "explanation": "Stable dependency layers can remain cached when application source changes.",
    },
    {
        "id": "rest-idempotent",
        "competency": "REST APIs",
        "prompt": "Which HTTP method is normally used for an idempotent full replacement of a resource?",
        "options": ["PUT", "POST", "CONNECT", "TRACE"],
        "answer": "PUT",
        "difficulty": "foundation",
        "explanation": "PUT is defined with idempotent semantics for creating or replacing a target resource.",
    },
]


def _question_for(competency: str) -> dict | None:
    candidates = [item for item in QUESTION_BANK if skill_similarity(competency, item["competency"]) > 0.7]
    return candidates[0].copy() if candidates else None


def build_assessment(requirements: list[dict], coverage: dict[str, float] | None = None, limit: int = 5) -> list[dict]:
    coverage = coverage or {}
    ordered = sorted(
        requirements,
        key=lambda item: (
            coverage.get(normalize(str(item.get("name", ""))), 0.0),
            -float(item.get("weight", 1.0)),
        ),
    )
    questions = []
    used_ids: set[str] = set()
    for requirement in ordered:
        competency = str(requirement.get("name", "")).strip()
        question = _question_for(competency)
        if question is None:
            question = {
                "id": f"manual-{normalize(competency).replace(' ', '-')}",
                "competency": competency,
                "prompt": f"Describe a specific situation where you applied {competency}, your actions, and the measurable result.",
                "options": [],
                "answer": None,
                "difficulty": "applied",
                "manual_review": True,
                "explanation": "This response needs a human reviewer because the controlled objective bank does not cover this competency yet.",
            }
        if question["id"] in used_ids:
            continue
        question.setdefault("manual_review", False)
        questions.append(question)
        used_ids.add(question["id"])
        if len(questions) >= limit:
            break
    return questions


def public_questions(questions: list[dict]) -> list[dict]:
    fields = {"id", "competency", "prompt", "options", "difficulty", "manual_review"}
    return [{key: value for key, value in question.items() if key in fields} for question in questions]


def score_assessment(questions: list[dict], answers: dict[str, str]) -> dict:
    competency_points: dict[str, list[float]] = defaultdict(list)
    feedback = []
    objective_scores = []

    for question in questions:
        response = answers.get(question["id"], "").strip()
        competency = question["competency"]
        if question.get("manual_review"):
            feedback.append(f"{competency}: saved for human review; it does not change the automated score.")
            continue
        correct = response.casefold() == str(question["answer"]).casefold()
        points = 1.0 if correct else 0.0
        objective_scores.append(points)
        competency_points[competency].append(points)
        result = "correct" if correct else "needs review"
        feedback.append(f"{competency}: {result}. {question['explanation']}")

    competency_scores = {
        competency: round(sum(points) / len(points), 3)
        for competency, points in competency_points.items()
    }
    score = 100.0 * sum(objective_scores) / len(objective_scores) if objective_scores else 0.0
    return {
        "score": round(score, 1),
        "competency_scores": competency_scores,
        "feedback": feedback,
        "integrity_flags": [],
    }
