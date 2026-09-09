from app.services.talent_intelligence import analyze_job_description, analyze_resume


def test_resume_analysis_extracts_job_evidence_and_excludes_sensitive_fields() -> None:
    text = """
    Data analyst test@example.com +91 98765 43210 with 3 years of experience using Python, pandas, PostgreSQL and Power BI.
    Built a customer churn project and deployed a dashboard that reduced weekly reporting time by 30%.
    Worked with stakeholders to define metrics and present analytical insights.
    """ * 4

    result = analyze_resume(text)

    assert {item["skill"] for item in result["skills"]} >= {"Python", "SQL", "Power BI"}
    assert result["experience_years"] == 3
    assert result["project_signals"]
    assert "age or date of birth" in result["excluded_fields"]
    assert all("test@example.com" not in item["evidence_excerpt"] for item in result["skills"])
    assert all("98765" not in item["evidence_excerpt"] for item in result["skills"])


def test_job_analysis_builds_weighted_requirements_and_language_warnings() -> None:
    description = """
    You must use Python and SQL to analyze product experiments. Build Power BI dashboards,
    collaborate with product teams, and explain statistical results. We need a young and energetic
    rockstar with 3 years of experience. The role owns A/B testing and delivers measurable insights.
    """

    result = analyze_job_description("Product Data Analyst", description)

    python = next(item for item in result["requirements"] if item["name"] == "Python")
    assert python["mandatory"] is True
    assert any("young and energetic" in warning for warning in result["quality_warnings"])
    assert result["responsibilities"]
