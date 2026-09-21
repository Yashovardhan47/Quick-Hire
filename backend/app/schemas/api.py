import json
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models.entities import ApplicationStatus, UserRole


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=160)
    password: str = Field(min_length=10, max_length=128)
    role: UserRole
    admin_invite_token: str | None = Field(default=None, min_length=32, max_length=500)

    @model_validator(mode="after")
    def validate_role_authorization(self):
        if self.role == UserRole.admin and not self.admin_invite_token:
            raise ValueError("An administrator invitation is required for admin registration")
        if self.role != UserRole.admin and self.admin_invite_token:
            raise ValueError("Administrator invitations can only create admin accounts")
        return self


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: EmailStr
    full_name: str
    role: UserRole
    email_verified: bool
    google_linked: bool


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserRead


class GoogleAuthRequest(BaseModel):
    credential: str = Field(min_length=100, max_length=10_000)
    mode: Literal["login", "register"] = "login"
    role: Literal[UserRole.candidate, UserRole.recruiter] | None = None


class GoogleLinkRequest(BaseModel):
    credential: str = Field(min_length=100, max_length=10_000)


class AuthMethodsRead(BaseModel):
    email: EmailStr
    password_enabled: bool
    google_linked: bool
    email_verified: bool


class AdminInviteCreate(BaseModel):
    email: EmailStr
    expires_in_hours: int = Field(default=48, ge=1, le=168)


class AdminInviteIssued(BaseModel):
    email: EmailStr
    expires_at: datetime
    invite_token: str
    signup_url: str
    notice: Literal["single_use_email_bound_admin_invitation"] = "single_use_email_bound_admin_invitation"


class EmailActionRequest(BaseModel):
    email: EmailStr


class TokenConfirmRequest(BaseModel):
    token: str = Field(min_length=32, max_length=500)


class PasswordResetConfirm(TokenConfirmRequest):
    new_password: str = Field(min_length=10, max_length=128)


class RequirementInput(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    weight: float = Field(default=1, gt=0, le=10)
    mandatory: bool = False


class JobCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    company: str = Field(min_length=2, max_length=200)
    description: str = Field(min_length=20, max_length=100_000)
    location: str = Field(default="", max_length=160)
    employment_type: str = Field(default="full-time", max_length=60)
    requirements: list[RequirementInput] = Field(min_length=1, max_length=100)
    status: Literal["draft", "published"] = "draft"


class JobRead(JobCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    recruiter_id: str
    created_at: datetime


class JobStatusUpdate(BaseModel):
    status: Literal["draft", "published", "closed"]


class CandidateProfileInput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    headline: str = Field(default="", max_length=200)
    bio: str = Field(default="", max_length=20_000)
    location: str = Field(default="", max_length=160)
    experience_years: float = Field(default=0, ge=0, le=80)
    skills: list[str] = Field(default_factory=list, max_length=100)
    preferences: dict = Field(default_factory=dict)

    @field_validator("skills")
    @classmethod
    def normalize_skills(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            skill = value.strip()
            if not skill:
                continue
            if len(skill) > 160:
                raise ValueError("Each skill must contain at most 160 characters")
            key = skill.casefold()
            if key not in seen:
                normalized.append(skill)
                seen.add(key)
        return normalized

    @field_validator("preferences")
    @classmethod
    def bound_preferences(cls, value: dict) -> dict:
        if len(json.dumps(value, ensure_ascii=False, default=str)) > 20_000:
            raise ValueError("Preferences payload is too large")
        return value


class CandidateConsentUpdate(BaseModel):
    granted: bool


class CandidateConsentRead(BaseModel):
    purpose: Literal["external_model_processing"] = "external_model_processing"
    granted: bool
    policy_version: str
    updated_at: datetime | None = None


class EvidenceCreate(BaseModel):
    skill: str = Field(min_length=1, max_length=160)
    source_type: Literal["resume", "project", "assessment", "interview", "portfolio", "manual"]
    description: str = Field(min_length=3, max_length=20_000)
    strength: float = Field(ge=0, le=1)
    confidence: float = Field(ge=0, le=1)
    verified: bool = False
    source_uri: str | None = Field(default=None, max_length=500)


class EvidenceRead(EvidenceCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    candidate_id: str


class RequirementMatch(BaseModel):
    requirement: str
    weight: float
    coverage: float
    confidence: float
    evidence: list[str]
    mandatory: bool


class EvidenceCitation(BaseModel):
    requirement: str
    source_uri: str
    excerpt: str
    verified: bool


class MatchResult(BaseModel):
    score: float
    confidence: float
    score_low: float
    score_high: float
    recommendation: Literal["verified_fit", "needs_review", "evidence_missing"]
    requirements: list[RequirementMatch]
    missing_requirements: list[str]
    next_best_actions: list[str]
    model_version: str
    ranking_features: dict[str, float] = Field(default_factory=dict)
    retrieval_mode: str = "structured_evidence"
    confidence_status: Literal["limited_evidence", "uncalibrated", "evidence_backed"] = "uncalibrated"
    abstained: bool = False
    abstention_reason: str | None = None
    evidence_citations: list[EvidenceCitation] = Field(default_factory=list)


class ApplicationCreate(BaseModel):
    job_id: str


class ApplicationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    job_id: str
    candidate_id: str
    status: ApplicationStatus
    fit_score: float | None
    fit_confidence: float | None
    explanation: dict
    human_decision_reason: str | None
    created_at: datetime
    updated_at: datetime


class CandidateApplicationRead(ApplicationRead):
    job_title: str
    company: str
    location: str


class ResumeAnalysisRequest(BaseModel):
    text: str = Field(min_length=80, max_length=100_000)
    persist_evidence: bool = False


class SkillSignal(BaseModel):
    skill: str
    confidence: float = Field(ge=0, le=1)
    evidence_excerpt: str
    source_locator: str | None = None


class ResumeAnalysisResult(BaseModel):
    skills: list[SkillSignal]
    experience_years: float | None
    experience_signals: list[str]
    project_signals: list[str]
    education_signals: list[str] = Field(default_factory=list)
    entities: dict[str, list[str]] = Field(default_factory=dict)
    summary: str
    quality_warnings: list[str]
    excluded_fields: list[str]
    language_codes: list[str] = Field(default_factory=list)
    model_version: str


class ResumeDocumentResult(BaseModel):
    document_id: str | None
    filename: str
    media_type: str
    sha256: str
    size_bytes: int
    page_count: int
    text_length: int
    language_codes: list[str]
    security_flags: list[str]
    duplicate: bool = False
    retention_notice: str
    analysis: ResumeAnalysisResult


class JobAnalysisRequest(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(min_length=40, max_length=100_000)


class JobAnalysisResult(BaseModel):
    title: str
    summary: str
    requirements: list[RequirementInput]
    responsibilities: list[str]
    quality_warnings: list[str]
    model_version: str


class JobRecommendation(BaseModel):
    job_id: str
    title: str
    company: str
    location: str
    rank_score: float
    match: MatchResult


class AssessmentQuestion(BaseModel):
    id: str
    competency: str
    prompt: str
    options: list[str]
    difficulty: Literal["foundation", "applied", "advanced"]
    manual_review: bool = False


class AssessmentAttemptRead(BaseModel):
    id: str
    job_id: str
    status: str
    questions: list[AssessmentQuestion]
    model_version: str
    started_at: datetime


class AssessmentSubmit(BaseModel):
    answers: dict[str, str]


class AssessmentResult(BaseModel):
    id: str
    status: str
    score: float
    competency_scores: dict[str, float]
    feedback: list[str]
    integrity_flags: list[str]
    completed_at: datetime
    model_version: str


class InterviewQuestion(BaseModel):
    id: str
    competency: str
    prompt: str
    evaluation_criteria: list[str]
    evidence_citations: list[EvidenceCitation] = Field(default_factory=list)


class InterviewSessionRead(BaseModel):
    id: str
    job_id: str
    status: str
    questions: list[InterviewQuestion]
    notice: str
    model_version: str


class InterviewSubmit(BaseModel):
    answers: dict[str, str]


class InterviewResult(BaseModel):
    id: str
    status: str
    content_score: float
    rubric_scores: dict[str, float]
    feedback: list[str]
    human_review_required: bool = True
    model_version: str
    evaluation_mode: str = "local_content_rubric"
    evidence_citations: list[EvidenceCitation] = Field(default_factory=list)
    agent_trace: list[dict] = Field(default_factory=list)


class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus
    reason: str = Field(min_length=10, max_length=2_000)
    human_confirmed: Literal[True]
    evidence_reviewed: Literal[True]


class ApplicationWithdraw(BaseModel):
    reason: str = Field(default="Candidate withdrew the application.", min_length=3, max_length=2_000)


class RecruiterApplicationRead(ApplicationRead):
    job_title: str
    candidate_label: str


class RecruiterAssistantRequest(BaseModel):
    action: Literal["queue_summary", "evidence_gaps", "interview_plan", "candidate_update"]
    application_id: str | None = None


class RecruiterAssistantResponse(BaseModel):
    action: str
    title: str
    summary: str
    items: list[str]
    warnings: list[str]
    decision_notice: Literal["advisory_only_human_decision_required"] = "advisory_only_human_decision_required"


class RecruiterCopilotChatRequest(BaseModel):
    message: str = Field(min_length=3, max_length=2_000)
    application_id: str | None = None


class CopilotCandidateMatch(BaseModel):
    application_id: str
    candidate_label: str
    status: str
    fit_score: float | None
    fit_confidence: float | None
    matched_requirements: list[str] = Field(default_factory=list)
    missing_requirements: list[str] = Field(default_factory=list)


class RecruiterCopilotChatResponse(BaseModel):
    answer: str
    interpreted_intent: str
    candidates: list[CopilotCandidateMatch] = Field(default_factory=list)
    evidence_notes: list[str] = Field(default_factory=list)
    agent_trace: list[dict] = Field(default_factory=list)
    warnings: list[str]
    decision_notice: Literal["advisory_only_human_decision_required"] = "advisory_only_human_decision_required"


class VoiceTranscriptRead(BaseModel):
    transcript: str
    retained_audio: Literal[False] = False
    evaluation_basis: Literal["answer_text_only"] = "answer_text_only"
    model_version: str
    notice: str


class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5_000)


class MessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    conversation_id: str
    sender_id: str
    sender_name: str
    sender_role: UserRole
    body: str
    created_at: datetime
    read_at: datetime | None


class ConversationRead(BaseModel):
    id: str
    application_id: str
    job_id: str
    job_title: str
    counterpart_name: str
    last_message: str | None = None
    last_message_at: datetime | None = None
    unread_count: int = 0


class InterviewScheduleCreate(BaseModel):
    application_id: str
    starts_at: datetime
    duration_minutes: int = Field(default=45, ge=15, le=240)
    timezone: str = Field(default="UTC", min_length=1, max_length=80)
    meeting_url: str | None = Field(default=None, max_length=500)


class InterviewScheduleUpdate(BaseModel):
    action: Literal["confirm", "decline", "cancel"]
    candidate_note: str = Field(default="", max_length=2_000)


class InterviewScheduleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    application_id: str
    job_id: str
    job_title: str
    candidate_id: str
    candidate_name: str
    recruiter_id: str
    starts_at: datetime
    duration_minutes: int
    timezone: str
    meeting_url: str | None
    status: str
    candidate_note: str
    created_at: datetime
    updated_at: datetime


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    event_type: str
    title: str
    body: str
    data: dict
    read_at: datetime | None
    created_at: datetime


class NotificationPreferenceUpdate(BaseModel):
    browser_enabled: bool
    email_transactional_enabled: bool
    email_digest_enabled: bool


class NotificationPreferenceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    in_app_enabled: bool
    browser_enabled: bool
    email_transactional_enabled: bool
    email_digest_enabled: bool


class ModelEvaluationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    model_version: str
    dataset_version: str
    metrics: dict
    status: str
    approved_at: datetime | None
    created_at: datetime


class CandidateRequestCreate(BaseModel):
    request_type: Literal["correction", "appeal", "accommodation", "data_export", "deletion"]
    details: str = Field(min_length=10, max_length=5_000)


class CandidateRequestResolve(BaseModel):
    status: Literal["in_review", "resolved", "denied"]
    resolution: str = Field(default="", max_length=5_000)


class CandidateRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    candidate_id: str
    request_type: str
    details: str
    status: str
    resolution: str
    resolved_at: datetime | None
    created_at: datetime
    updated_at: datetime


class PlatformMetrics(BaseModel):
    users: int
    candidates: int
    recruiters: int
    candidate_documents: int
    published_jobs: int
    applications: int
    completed_assessments: int
    completed_mock_interviews: int
    audit_events: int
    live_connections: int
    messages: int
    scheduled_interviews: int
    pending_email_deliveries: int
    failed_email_deliveries: int
    open_candidate_requests: int
    knowledge_chunks: int
    agent_runs: int
    model_version: str
    evaluation_state: Literal["dataset_required", "evaluating", "approved"]


class AIPolicyRead(BaseModel):
    version: str
    decision_authority: Literal["human_recruiter_only"]
    interview_input_mode: Literal["answer_text_only_typed_or_transcribed"]
    autonomous_stage_changes_allowed: Literal[False]
    prohibited_signal_categories: list[str]
    enforcement_points: list[str]
