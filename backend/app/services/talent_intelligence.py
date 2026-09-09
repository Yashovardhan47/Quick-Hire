import re


MODEL_VERSION = "multilingual-talent-normalizer-0.3.0"

SKILL_TAXONOMY: dict[str, tuple[str, ...]] = {
    "Python": ("python", "pandas", "numpy"),
    "SQL": ("sql", "postgresql", "mysql", "sqlite"),
    "Data analysis": ("data analysis", "data analytics", "analytical insights", "डेटा विश्लेषण", "डेटा एनालिटिक्स", "డేటా విశ్లేషణ"),
    "Statistics": ("statistics", "statistical", "hypothesis testing", "सांख्यिकी", "గణాంకాలు"),
    "Machine learning": ("machine learning", "scikit-learn", "sklearn", "मशीन लर्निंग", "యంత్ర అభ్యాసం"),
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
    "Communication": ("communication", "stakeholder management", "presentations", "संचार", "संवाद", "కమ్యూనికేషన్"),
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
    return [part.strip(" \t-•") for part in re.split(r"[\n\r]+|(?<=[.!?।])\s+", text) if len(part.strip()) >= 12]


def _contains_alias(text: str, alias: str) -> bool:
    escaped = re.escape(alias.lower()).replace(r"\ ", r"\s+")
    return re.search(rf"(?<![a-z0-9]){escaped}(?![a-z0-9])", text.lower()) is not None


def _redact_contact_details(text: str) -> str:
    text = re.sub(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", "[email removed]", text, flags=re.I)
    return re.sub(r"(?<!\d)(?:\+?\d[\s().-]*){10,14}(?!\d)", "[phone removed]", text)


def _excerpt(text: str, aliases: tuple[str, ...]) -> str:
    for sentence in _sentences(text):
        if any(_contains_alias(sentence, alias) for alias in aliases):
            return _redact_contact_details(sentence)[:240]
    return "Skill listed in the supplied text."


def detect_language_codes(text: str) -> list[str]:
    scripts = {
        "hi": len(re.findall(r"[\u0900-\u097f]", text)),
        "bn": len(re.findall(r"[\u0980-\u09ff]", text)),
        "ta": len(re.findall(r"[\u0b80-\u0bff]", text)),
        "te": len(re.findall(r"[\u0c00-\u0c7f]", text)),
        "kn": len(re.findall(r"[\u0c80-\u0cff]", text)),
    }
    codes = [code for code, count in scripts.items() if count >= 4]
    if len(re.findall(r"[A-Za-z]", text)) >= 10:
        codes.insert(0, "en")
    return codes or ["und"]


def _source_locator(aliases: tuple[str, ...], segments: list[dict[str, str]] | None) -> str | None:
    for segment in segments or []:
        if any(_contains_alias(segment["text"], alias) for alias in aliases):
            return segment["locator"]
    return None


def extract_skills(text: str, segments: list[dict[str, str]] | None = None) -> list[dict]:
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
                "source_locator": _source_locator(aliases, segments),
            }
        )
    return results


def analyze_resume(text: str, segments: list[dict[str, str]] | None = None) -> dict:
    skills = extract_skills(text, segments)
    year_values = [
        float(value)
        for value in re.findall(r"(?<!\d)(\d{1,2})(?:\+)?\s*(?:years?|yrs?|वर्ष|साल|సంవత్సరాలు?)", text, re.I)
    ]
    experience_years = max(year_values) if year_values else None
    experience_signals = [
        _redact_contact_details(sentence)[:240]
        for sentence in _sentences(text)
        if re.search(r"\b(experience|worked|developed|built|led|managed|implemented|designed)\b|अनुभव|काम किया|అనుభవం|అభివృద్ధి", sentence, re.I)
    ][:8]
    project_signals = [
        _redact_contact_details(sentence)[:240]
        for sentence in _sentences(text)
        if re.search(r"\b(project|portfolio|github|deployed|created|prototype)\b|परियोजना|प्रोजेक्ट|ప్రాజెక్ట్", sentence, re.I)
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
        "language_codes": detect_language_codes(text),
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
