import re


MODEL_VERSION = "talent-normalizer-0.2.0"

SKILL_TAXONOMY: dict[str, tuple[str, ...]] = {
    "Python": ("python", "pandas", "numpy"),
    "SQL": ("sql", "postgresql", "mysql", "sqlite"),
    "Data analysis": ("data analysis", "data analytics", "analytical insights"),
    "Statistics": ("statistics", "statistical", "hypothesis testing"),
    "Machine learning": ("machine learning", "scikit-learn", "sklearn"),
    "Deep learning": ("deep learning", "pytorch", "tensorflow", "keras"),
    "Natural language processing": ("natural language processing", "nlp", "transformers"),
    "Generative AI": ("generative ai", "large language model", "llm", "rag"),
    "FastAPI": ("fastapi",),
    "Django": ("django",),
    "Flask": ("flask",),
    "React": ("react", "reactjs", "react.js"),
    "TypeScript": ("typescript",),
    "JavaScript": ("javascript", "node.js", "nodejs"),
    "Java": ("java", "spring boot", "springboot"),
    "C++": ("c++", "cpp"),
    "C#": ("c#", ".net", "dotnet"),
    "AWS": ("aws", "amazon web services"),
    "Azure": ("azure",),
    "Docker": ("docker", "containerization"),
    "Kubernetes": ("kubernetes", "k8s"),
    "Git": ("git", "github", "gitlab"),
    "Power BI": ("power bi", "powerbi"),
    "Tableau": ("tableau",),
    "Excel": ("excel", "spreadsheets"),
    "A/B testing": ("a/b testing", "ab testing", "experimentation"),
    "Data structures and algorithms": ("data structures", "algorithms", "dsa"),
    "REST APIs": ("rest api", "restful", "api development"),
    "Communication": ("communication", "stakeholder management", "presentations"),
    "Product management": ("product management", "product roadmap", "product strategy"),
}

EXCLUDED_FIELDS = [
    "name and contact details",
    "age or date of birth",
    "gender",
    "photograph",
    "marital or family status",
    "religion, nationality or ethnicity",
    "disability or medical information",
]


def _sentences(text: str) -> list[str]:
    return [part.strip(" \t-•") for part in re.split(r"[\n\r]+|(?<=[.!?])\s+", text) if len(part.strip()) >= 12]


def _contains_alias(text: str, alias: str) -> bool:
    escaped = re.escape(alias.lower()).replace(r"\ ", r"\s+")
    return re.search(rf"(?<![a-z0-9]){escaped}(?![a-z0-9])", text.lower()) is not None


def _excerpt(text: str, aliases: tuple[str, ...]) -> str:
    for sentence in _sentences(text):
        if any(_contains_alias(sentence, alias) for alias in aliases):
            return sentence[:240]
    return "Skill listed in the supplied text."


def extract_skills(text: str) -> list[dict]:
    results = []
    for skill, aliases in SKILL_TAXONOMY.items():
        matches = [alias for alias in aliases if _contains_alias(text, alias)]
        if not matches:
            continue
        confidence = min(0.9, 0.62 + 0.08 * len(matches))
        results.append(
            {
                "skill": skill,
                "confidence": round(confidence, 2),
                "evidence_excerpt": _excerpt(text, aliases),
            }
        )
    return results


def analyze_resume(text: str) -> dict:
    skills = extract_skills(text)
    year_values = [float(value) for value in re.findall(r"(?<!\d)(\d{1,2})(?:\+)?\s*(?:years?|yrs?)", text, re.I)]
    experience_years = max(year_values) if year_values else None
    experience_signals = [
        sentence[:240]
        for sentence in _sentences(text)
        if re.search(r"\b(experience|worked|developed|built|led|managed|implemented|designed)\b", sentence, re.I)
    ][:8]
    project_signals = [
        sentence[:240]
        for sentence in _sentences(text)
        if re.search(r"\b(project|portfolio|github|deployed|created|prototype)\b", sentence, re.I)
    ][:6]
    warnings = []
    if len(text.split()) < 120:
        warnings.append("The resume has limited detail; extracted claims should be verified with projects or an assessment.")
    if not skills:
        warnings.append("No skills matched the current controlled taxonomy; add them manually for review.")
    if not project_signals:
        warnings.append("No project evidence was detected; measurable project outcomes would improve confidence.")

    years_phrase = f" and up to {experience_years:g} years of stated experience" if experience_years is not None else ""
    return {
        "skills": skills,
        "experience_years": experience_years,
        "experience_signals": experience_signals,
        "project_signals": project_signals,
        "summary": f"Detected {len(skills)} job-related skills{years_phrase}. All extracted claims remain unverified until supported by evidence.",
        "quality_warnings": warnings,
        "excluded_fields": EXCLUDED_FIELDS,
        "model_version": MODEL_VERSION,
    }


def analyze_job_description(title: str, description: str) -> dict:
    skill_signals = extract_skills(description)
    requirements = []
    for signal in skill_signals:
        excerpt = signal["evidence_excerpt"].lower()
        mandatory = bool(re.search(r"\b(must|required|essential|minimum)\b", excerpt))
        requirements.append(
            {
                "name": signal["skill"],
                "weight": 2.0 if mandatory else 1.0,
                "mandatory": mandatory,
            }
        )

    responsibilities = [
        sentence[:260]
        for sentence in _sentences(description)
        if re.search(r"\b(build|design|develop|analyze|lead|manage|create|deliver|collaborate|own|implement)\b", sentence, re.I)
    ][:8]
    warnings = []
    discouraged = {
        "young and energetic": "Replace age-coded language with the job-related capability required.",
        "digital native": "Describe the required technology experience instead of an age-coded proxy.",
        "native speaker": "Specify the communication proficiency needed for the role.",
        "culture fit": "Use observable, job-related collaboration behaviours instead of cultural similarity.",
        "rockstar": "Use a concrete scope, outcome and competency instead of an ambiguous label.",
    }
    lowered = description.lower()
    for phrase, guidance in discouraged.items():
        if phrase in lowered:
            warnings.append(f"Review phrase ‘{phrase}’. {guidance}")
    if not requirements:
        warnings.append("No competencies matched the controlled taxonomy; a recruiter must add job-related requirements.")
    if not responsibilities:
        warnings.append("Add concrete responsibilities and measurable outcomes to improve question and rubric quality.")
    if "salary" not in lowered and "compensation" not in lowered:
        warnings.append("Compensation is not stated; consider adding a transparent range where legally appropriate.")

    return {
        "title": title,
        "summary": f"Structured {len(requirements)} competencies and {len(responsibilities)} responsibilities from the supplied description.",
        "requirements": requirements,
        "responsibilities": responsibilities,
        "quality_warnings": warnings,
        "model_version": MODEL_VERSION,
    }
