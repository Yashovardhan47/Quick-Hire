from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.entities import ApplicationStatus, UserRole


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=160)
    password: str = Field(min_length=10, max_length=128)
    role: Literal[UserRole.candidate, UserRole.recruiter]


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: EmailStr
    full_name: str
    role: UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class RequirementInput(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    weight: float = Field(default=1, gt=0, le=10)
    mandatory: bool = False


class JobCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    company: str = Field(min_length=2, max_length=200)
    description: str = Field(min_length=20)
    location: str = ""
    employment_type: str = "full-time"
    requirements: list[RequirementInput] = Field(min_length=1)
    status: Literal["draft", "published"] = "draft"


class JobRead(JobCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    recruiter_id: str
    created_at: datetime


class CandidateProfileInput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    headline: str = ""
    bio: str = ""
    location: str = ""
    experience_years: float = Field(default=0, ge=0, le=80)
    skills: list[str] = Field(default_factory=list)
    preferences: dict = Field(default_factory=dict)


class EvidenceCreate(BaseModel):
    skill: str = Field(min_length=1, max_length=160)
    source_type: Literal["resume", "project", "assessment", "interview", "portfolio", "manual"]
    description: str = Field(min_length=3)
    strength: float = Field(ge=0, le=1)
    confidence: float = Field(ge=0, le=1)
    verified: bool = False
    source_uri: str | None = None


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
    created_at: datetime
