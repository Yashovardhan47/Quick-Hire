import json
import re

import httpx

from app.services.ai_policy import safe_requirements
from app.services.model_providers import ModelProviderError, llm_json_completion


MODEL_VERSION = "recruiter-copilot-tools-0.6.0"
STAGES = {"applied", "under_review", "assessment", "interview", "offer", "hired", "rejected", "withdrawn"}


def _step(agent: str, status: str, detail: str, **data) -> dict:
    return {"agent": agent, "status": status, "detail": detail, "data": data}


def _local_intent(message: str, requirements: list[dict]) -> dict:
    lowered = message.casefold()
    threshold_match = re.search(r"(?:above|over|at least|minimum|min(?:imum)? score)\s*(\d{1,3})", lowered)
    threshold = min(100, int(threshold_match.group(1))) if threshold_match else None
    skill = next(
        (
            str(item.get("name", ""))
            for item in safe_requirements(requirements)
            if str(item.get("name", "")).casefold() in lowered
        ),
        None,
    )
    stage = next((value for value in STAGES if value.replace("_", " ") in lowered), None)
    if "gap" in lowered or "missing" in lowered:
        intent = "evidence_gaps"
    elif threshold is not None or skill or stage:
        intent = "candidate_search"
    else:
        intent = "queue_summary"
    return {"intent": intent, "minimum_fit": threshold, "skill": skill, "stage": stage}


async def interpret_intent(message: str, job, settings) -> tuple[dict, dict]:
    fallback = _local_intent(message, job.requirements)
    available = bool(
        settings.external_model_data_processing_enabled
        and settings.ai_api_key
        and settings.llm_api_url
    )
    if not available:
        return fallback, _step(
            "intent_agent",
            "local",
            "Interpreted the recruiter request locally; no candidate information left the platform.",
            intent=fallback["intent"],
        )
    prompt = json.dumps(
        {
            "recruiter_request": message,
            "allowed_job_requirements": [item.get("name") for item in safe_requirements(job.requirements)],
            "allowed_stages": sorted(STAGES),
            "output_schema": {
                "intent": "queue_summary | candidate_search | evidence_gaps",
                "minimum_fit": "integer 0..100 or null",
                "skill": "one exact allowed requirement or null",
                "stage": "one exact allowed stage or null",
            },
        }
    )
    try:
        payload = await llm_json_completion(
            settings.llm_api_url,
            settings.llm_model,
            settings.ai_api_key,
            system_prompt=(
                "Convert a recruiter request into a read-only search plan. Never request protected traits, never make "
                "employment decisions, and return JSON only. You receive no candidate data."
            ),
            user_prompt=prompt,
            timeout_seconds=settings.ai_request_timeout_seconds,
            max_tokens=300,
        )
        intent = str(payload.get("intent", ""))
        skill = payload.get("skill")
        allowed_skills = {str(item.get("name")) for item in safe_requirements(job.requirements)}
        stage = payload.get("stage")
        minimum_fit = payload.get("minimum_fit")
        parsed = {
            "intent": intent if intent in {"queue_summary", "candidate_search", "evidence_gaps"} else fallback["intent"],
            "minimum_fit": max(0, min(100, int(minimum_fit))) if minimum_fit is not None else None,
            "skill": str(skill) if skill in allowed_skills else None,
            "stage": str(stage) if stage in STAGES else None,
        }
        return parsed, _step(
            "intent_agent",
            "completed",
            "Converted the natural-language request into a validated read-only tool plan.",
            intent=parsed["intent"],
            provider_model=settings.llm_model,
        )
    except (httpx.HTTPError, ModelProviderError, TypeError, ValueError):
        return fallback, _step(
            "intent_agent",
            "provider_fallback",
            "External intent parsing failed safely; local parsing produced the read-only plan.",
            intent=fallback["intent"],
        )


def _matched_requirements(explanation: dict) -> list[str]:
    return [
        str(item.get("requirement"))
        for item in explanation.get("requirements", [])
        if float(item.get("coverage", 0) or 0) >= 0.45
    ]


def execute_read_only_plan(applications: list, plan: dict, selected_application_id: str | None = None) -> tuple[list[dict], list[str]]:
    rows = []
    for application in applications:
        if selected_application_id and application.id != selected_application_id:
            continue
        explanation = application.explanation or {}
        matched = _matched_requirements(explanation)
        missing = [str(value) for value in explanation.get("missing_requirements", [])]
        if plan.get("minimum_fit") is not None and float(application.fit_score or 0) < plan["minimum_fit"]:
            continue
        if plan.get("stage") and application.status.value != plan["stage"]:
            continue
        skill = plan.get("skill")
        if skill:
            relevant = missing if plan.get("intent") == "evidence_gaps" else matched
            if skill.casefold() not in {value.casefold() for value in relevant}:
                continue
        rows.append(
            {
                "application_id": application.id,
                "candidate_label": f"Candidate {application.candidate_id[:8].upper()}",
                "status": application.status.value,
                "fit_score": application.fit_score,
                "fit_confidence": application.fit_confidence,
                "matched_requirements": matched,
                "missing_requirements": missing,
            }
        )
    rows.sort(key=lambda item: (float(item["fit_score"] or 0), float(item["fit_confidence"] or 0)), reverse=True)
    evidence_notes = []
    if plan.get("skill"):
        evidence_notes.append(f"Filtered on the disclosed requirement {plan['skill']}.")
    if plan.get("minimum_fit") is not None:
        evidence_notes.append(f"Applied a recruiter-requested review threshold of {plan['minimum_fit']}%; this is not an automatic shortlist.")
    if plan.get("stage"):
        evidence_notes.append(f"Limited results to the human-recorded {plan['stage'].replace('_', ' ')} stage.")
    return rows[:25], evidence_notes


def answer_for_plan(job, plan: dict, rows: list[dict], total: int) -> str:
    if plan["intent"] == "queue_summary":
        return f"{job.title} has {total} application(s). I can filter this authorized queue by a job requirement, fit range, or human-recorded stage."
    if plan["intent"] == "evidence_gaps":
        gaps: dict[str, int] = {}
        for row in rows:
            for gap in row["missing_requirements"]:
                gaps[gap] = gaps.get(gap, 0) + 1
        if not gaps:
            return "No explicit evidence gaps were found in the selected authorized records. Review the citations before drawing a conclusion."
        summary = ", ".join(f"{name} ({count})" for name, count in sorted(gaps.items(), key=lambda item: -item[1])[:5])
        return f"The most frequent missing or weakly supported requirements are {summary}. These are verification needs, not rejection reasons."
    return f"The read-only search found {len(rows)} matching application(s) from {total} authorized records. Review each evidence map and uncertainty before any human decision."
