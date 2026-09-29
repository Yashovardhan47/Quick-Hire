import { pushNotification } from "./liveState";

type DemoRole = "candidate" | "recruiter" | "admin";

const evidence = [
  { id: "ev-python", skill: "Python", verified: true },
  { id: "ev-fastapi", skill: "FastAPI", verified: true },
  { id: "ev-ml", skill: "Machine learning", verified: true },
  { id: "ev-sql", skill: "SQL", verified: true },
  { id: "ev-nlp", skill: "Natural language processing", verified: false },
  { id: "ev-docker", skill: "Docker", verified: false },
];

const recommendationRows = [
  {
    job_id: "job-ai-01",
    title: "Applied AI Engineer",
    company: "Aster Labs",
    location: "Bengaluru · Hybrid",
    rank_score: 0.89,
    match: {
      score: 88,
      confidence: 0.84,
      score_low: 82,
      score_high: 91,
      requirements: [
        { requirement: "Python", coverage: 0.96, confidence: 0.94 },
        { requirement: "Machine learning", coverage: 0.91, confidence: 0.88 },
        { requirement: "FastAPI", coverage: 0.86, confidence: 0.84 },
        { requirement: "MLOps", coverage: 0.34, confidence: 0.46 },
      ],
      missing_requirements: ["MLOps", "Model monitoring"],
      next_best_actions: ["Complete the 12-minute MLOps verification to strengthen this match."],
      ranking_features: { structured_evidence: 92, semantic_similarity: 86, cross_feature_reranker: 89 },
      confidence_status: "calibrated_high",
      abstained: false,
      abstention_reason: null,
      evidence_citations: [
        { requirement: "Python", source_uri: "resume:page-1", excerpt: "Built FastAPI services for an ML-powered workflow.", verified: true },
        { requirement: "Machine learning", source_uri: "assessment:ml-foundations", excerpt: "Verified objective assessment score: 89%.", verified: true },
        { requirement: "FastAPI", source_uri: "project:evidence-api", excerpt: "Designed typed REST endpoints with validation and tests.", verified: true },
      ],
    },
  },
  {
    job_id: "job-ds-02",
    title: "Product Data Scientist",
    company: "Northstar Commerce",
    location: "Remote · India",
    rank_score: 0.81,
    match: {
      score: 81,
      confidence: 0.76,
      score_low: 73,
      score_high: 86,
      requirements: [
        { requirement: "Python", coverage: 0.93, confidence: 0.91 },
        { requirement: "SQL", coverage: 0.88, confidence: 0.86 },
        { requirement: "Experiment design", coverage: 0.48, confidence: 0.55 },
      ],
      missing_requirements: ["Experiment design", "Product analytics"],
      next_best_actions: ["Add one experiment-analysis project with a measurable product outcome."],
      ranking_features: { structured_evidence: 84, semantic_similarity: 80, cross_feature_reranker: 81 },
      confidence_status: "calibrated_medium",
      abstained: false,
      abstention_reason: null,
      evidence_citations: [
        { requirement: "Python", source_uri: "resume:page-1", excerpt: "Automated data-quality checks in Python.", verified: true },
        { requirement: "SQL", source_uri: "assessment:sql-advanced", excerpt: "Verified SQL assessment score: 92%.", verified: true },
      ],
    },
  },
  {
    job_id: "job-platform-03",
    title: "ML Platform Engineer",
    company: "Vertex Systems",
    location: "Hyderabad · On-site",
    rank_score: 0.55,
    match: {
      score: 64,
      confidence: 0.42,
      score_low: 46,
      score_high: 72,
      requirements: [
        { requirement: "Python", coverage: 0.91, confidence: 0.89 },
        { requirement: "Kubernetes", coverage: 0.12, confidence: 0.2 },
        { requirement: "Feature stores", coverage: 0.08, confidence: 0.16 },
      ],
      missing_requirements: ["Kubernetes", "Feature stores", "Production observability"],
      next_best_actions: ["Provide deployment evidence before this role is ranked conclusively."],
      ranking_features: { structured_evidence: 58, semantic_similarity: 62, cross_feature_reranker: 49 },
      confidence_status: "insufficient_evidence",
      abstained: true,
      abstention_reason: "Recommendation withheld because critical platform evidence is missing.",
      evidence_citations: [
        { requirement: "Python", source_uri: "resume:page-1", excerpt: "Developed Python services and automated tests.", verified: true },
      ],
    },
  },
];

let candidateApplications = [
  { id: "my-app-01", job_id: "job-ds-02", status: "under_review" },
  { id: "my-app-02", job_id: "job-backend-04", status: "assessment" },
];

const activityDelta = {
  candidate_documents: 0,
  completed_assessments: 0,
  completed_mock_interviews: 0,
  audit_events: 0,
  active_auth_sessions: 0,
  federated_identities: 0,
};

let jobs = [
  {
    id: "job-ai-01",
    title: "Applied AI Engineer",
    company: "Aster Labs",
    description: "Build explainable AI services and measurable evaluation workflows.",
    status: "published",
    requirements: [
      { name: "Python", weight: 0.3, mandatory: true },
      { name: "Machine learning", weight: 0.28, mandatory: true },
      { name: "FastAPI", weight: 0.22, mandatory: false },
      { name: "MLOps", weight: 0.2, mandatory: false },
    ],
  },
  {
    id: "job-data-05",
    title: "Senior Data Analyst",
    company: "Aster Labs",
    description: "Translate business questions into reproducible analysis and decision-ready insight.",
    status: "published",
    requirements: [
      { name: "SQL", weight: 0.35, mandatory: true },
      { name: "Python", weight: 0.25, mandatory: false },
      { name: "Data storytelling", weight: 0.2, mandatory: true },
      { name: "Experiment design", weight: 0.2, mandatory: false },
    ],
  },
];

const explanation = (
  missing: string[],
  action: string,
  structured: number,
  semantic: number,
  reranker: number,
) => ({
  missing_requirements: missing,
  next_best_actions: [action],
  ranking_features: {
    structured_evidence: structured,
    semantic_similarity: semantic,
    cross_feature_reranker: reranker,
  },
  confidence_status: "calibrated_medium",
  abstained: false,
  abstention_reason: null,
  evidence_citations: [
    { requirement: "Python", source_uri: "resume:page-1", excerpt: "Built and tested a production FastAPI service.", verified: true },
    { requirement: "Machine learning", source_uri: "assessment:ml-foundations", excerpt: "Verified assessment score: 89%.", verified: true },
    { requirement: "System design", source_uri: "interview:typed-answer-2", excerpt: "Explained monitoring, rollback, and failure isolation.", verified: false },
  ],
});

let applicationsByJob: Record<string, Array<Record<string, unknown>>> = {
  "job-ai-01": [
    { id: "app-101", candidate_label: "Candidate QH-1842", status: "under_review", fit_score: 88, fit_confidence: 0.84, location: "Bengaluru", experience: "3 years", applied_at: "Today", top_skills: ["Python", "FastAPI", "ML"], explanation: explanation(["MLOps"], "Request the targeted MLOps verification before advancing.", 92, 86, 89), human_decision_reason: null },
    { id: "app-102", candidate_label: "Candidate QH-2071", status: "assessment", fit_score: 82, fit_confidence: 0.78, location: "Hyderabad", experience: "2 years", applied_at: "Today", top_skills: ["Python", "NLP", "SQL"], explanation: explanation(["FastAPI", "Model monitoring"], "Review the completed API-design assessment.", 84, 81, 80), human_decision_reason: "Assessment requested to verify API design evidence." },
    { id: "app-103", candidate_label: "Candidate QH-3304", status: "interview", fit_score: 79, fit_confidence: 0.72, location: "Pune", experience: "4 years", applied_at: "Yesterday", top_skills: ["ML", "Docker", "APIs"], explanation: explanation(["Stakeholder communication"], "Use a structured, typed interview follow-up.", 80, 78, 79), human_decision_reason: "Recruiter confirmed job-related evidence warranted an interview." },
    { id: "app-104", candidate_label: "Candidate QH-1189", status: "offer", fit_score: 91, fit_confidence: 0.88, location: "Chennai", experience: "4 years", applied_at: "2 days ago", top_skills: ["Python", "MLOps", "FastAPI"], explanation: explanation([], "Complete reference and eligibility checks outside the AI ranking.", 94, 90, 92), human_decision_reason: "Hiring panel independently reviewed verified evidence." },
    { id: "app-105", candidate_label: "Candidate QH-4510", status: "applied", fit_score: 68, fit_confidence: 0.51, location: "Visakhapatnam", experience: "1 year", applied_at: "Today", top_skills: ["Python", "Pandas", "SQL"], explanation: { ...explanation(["MLOps", "FastAPI"], "Collect more evidence before making a recommendation.", 65, 71, 62), confidence_status: "low_evidence", abstained: true, abstention_reason: "Ranking withheld until critical evidence is verified." }, human_decision_reason: null },
    { id: "app-106", candidate_label: "Candidate QH-5924", status: "applied", fit_score: 75, fit_confidence: 0.69, location: "Bengaluru", experience: "2 years", applied_at: "Today", top_skills: ["Python", "PyTorch", "NLP"], explanation: explanation(["API design"], "Review service-design evidence before choosing a next stage.", 77, 79, 73), human_decision_reason: null },
    { id: "app-107", candidate_label: "Candidate QH-6148", status: "under_review", fit_score: 85, fit_confidence: 0.8, location: "Mumbai", experience: "3 years", applied_at: "Yesterday", top_skills: ["Python", "MLflow", "Docker"], explanation: explanation(["FastAPI"], "Verify production API evidence with the linked project.", 87, 84, 85), human_decision_reason: null },
    { id: "app-108", candidate_label: "Candidate QH-7215", status: "assessment", fit_score: 77, fit_confidence: 0.73, location: "Kochi", experience: "2 years", applied_at: "2 days ago", top_skills: ["SQL", "ML", "Statistics"], explanation: explanation(["MLOps", "API design"], "Complete the targeted API and deployment check.", 79, 78, 75), human_decision_reason: "Objective verification requested for two required competencies." },
    { id: "app-109", candidate_label: "Candidate QH-8063", status: "interview", fit_score: 87, fit_confidence: 0.83, location: "Gurugram", experience: "5 years", applied_at: "3 days ago", top_skills: ["FastAPI", "MLOps", "AWS"], explanation: explanation(["Responsible AI"], "Use the disclosed rubric to review model-governance experience.", 89, 85, 87), human_decision_reason: "Panel requested a structured discussion of model governance." },
    { id: "app-110", candidate_label: "Candidate QH-9341", status: "rejected", fit_score: 61, fit_confidence: 0.66, location: "Noida", experience: "2 years", applied_at: "4 days ago", top_skills: ["Java", "SQL", "Cloud"], explanation: explanation(["Python", "Machine learning"], "Do not infer missing requirements; review submitted evidence only.", 59, 66, 58), human_decision_reason: "Human reviewer found the required Python and ML evidence absent after verification." },
    { id: "app-111", candidate_label: "Candidate QH-0472", status: "hired", fit_score: 93, fit_confidence: 0.9, location: "Bengaluru", experience: "5 years", applied_at: "1 week ago", top_skills: ["Python", "MLOps", "Kubernetes"], explanation: explanation([], "Complete organizational onboarding outside the recommendation system.", 96, 91, 94), human_decision_reason: "Hiring panel completed independent technical and reference review." },
    { id: "app-112", candidate_label: "Candidate QH-3658", status: "under_review", fit_score: 72, fit_confidence: 0.64, location: "Remote", experience: "1 year", applied_at: "Yesterday", top_skills: ["Python", "scikit-learn", "Git"], explanation: explanation(["MLOps", "System design"], "Collect deployment evidence before deciding on verification.", 73, 75, 68), human_decision_reason: null },
  ],
  "job-data-05": [
    { id: "app-201", candidate_label: "Candidate QH-7781", status: "under_review", fit_score: 86, fit_confidence: 0.81, location: "Mumbai", experience: "3 years", applied_at: "Today", top_skills: ["SQL", "Power BI", "Python"], explanation: explanation(["Experiment design"], "Review experiment-analysis evidence.", 89, 84, 85), human_decision_reason: null },
    { id: "app-202", candidate_label: "Candidate QH-6620", status: "applied", fit_score: 74, fit_confidence: 0.68, location: "Delhi", experience: "2 years", applied_at: "Today", top_skills: ["Excel", "SQL", "Tableau"], explanation: explanation(["Data storytelling"], "Request a work-sample explanation.", 76, 75, 71), human_decision_reason: null },
    { id: "app-203", candidate_label: "Candidate QH-2490", status: "assessment", fit_score: 81, fit_confidence: 0.77, location: "Chennai", experience: "3 years", applied_at: "Yesterday", top_skills: ["SQL", "Statistics", "Python"], explanation: explanation(["Dashboard design"], "Review the submitted dashboard work sample.", 83, 80, 80), human_decision_reason: "Work sample requested to verify dashboard communication." },
    { id: "app-204", candidate_label: "Candidate QH-5107", status: "interview", fit_score: 84, fit_confidence: 0.79, location: "Hyderabad", experience: "4 years", applied_at: "2 days ago", top_skills: ["Power BI", "SQL", "Storytelling"], explanation: explanation(["Experiment design"], "Use a structured case question for experiment reasoning.", 86, 82, 84), human_decision_reason: "Human reviewer selected a structured interview after evidence review." },
    { id: "app-205", candidate_label: "Candidate QH-8832", status: "offer", fit_score: 90, fit_confidence: 0.87, location: "Pune", experience: "5 years", applied_at: "3 days ago", top_skills: ["SQL", "Analytics", "Research"], explanation: explanation([], "Complete non-AI eligibility and reference checks.", 92, 88, 90), human_decision_reason: "Hiring panel independently selected this candidate for an offer." },
    { id: "app-206", candidate_label: "Candidate QH-1016", status: "rejected", fit_score: 59, fit_confidence: 0.62, location: "Kolkata", experience: "1 year", applied_at: "4 days ago", top_skills: ["Excel", "Operations", "CRM"], explanation: explanation(["SQL", "Data modeling"], "Do not infer evidence that was not submitted.", 57, 63, 58), human_decision_reason: "Human reviewer confirmed required SQL evidence was absent." },
  ],
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const delay = () => new Promise(resolve => window.setTimeout(resolve, 120));

const normalizeSkill = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function upsertEvidence(skill: string, verified: boolean) {
  const existing = evidence.find(item => normalizeSkill(item.skill) === normalizeSkill(skill));
  if (existing) {
    existing.verified = existing.verified || verified;
    return;
  }
  evidence.push({
    id: `ev-${normalizeSkill(skill).replaceAll(" ", "-")}-${evidence.length + 1}`,
    skill,
    verified,
  });
}

function refreshRecommendationScores() {
  const evidenceBySkill = new Map(evidence.map(item => [normalizeSkill(item.skill), item]));
  for (const row of recommendationRows) {
    for (const requirement of row.match.requirements) {
      const signal = evidenceBySkill.get(normalizeSkill(requirement.requirement));
      if (!signal) continue;
      requirement.coverage = Math.max(requirement.coverage, signal.verified ? 0.95 : 0.64);
      requirement.confidence = Math.max(requirement.confidence, signal.verified ? 0.9 : 0.58);
    }
    const requirementCoverage = row.match.requirements.reduce((sum, item) => sum + item.coverage, 0) / Math.max(row.match.requirements.length, 1);
    const requirementConfidence = row.match.requirements.reduce((sum, item) => sum + item.confidence, 0) / Math.max(row.match.requirements.length, 1);
    row.match.score = Math.round(requirementCoverage * 100);
    row.match.confidence = Number(requirementConfidence.toFixed(2));
    row.match.score_low = Math.max(0, row.match.score - Math.round((1 - row.match.confidence) * 16));
    row.match.score_high = Math.min(100, row.match.score + Math.round((1 - row.match.confidence) * 10));
    row.rank_score = Number((row.match.score / 100).toFixed(2));
    row.match.ranking_features.structured_evidence = row.match.score;
    row.match.ranking_features.cross_feature_reranker = Math.round((row.match.score + row.match.ranking_features.semantic_similarity) / 2);
    row.match.missing_requirements = row.match.missing_requirements.filter(skill => {
      const signal = evidenceBySkill.get(normalizeSkill(skill));
      return !signal?.verified;
    });
    if (row.match.confidence >= 0.68 && row.match.abstained) {
      row.match.abstained = false;
      row.match.abstention_reason = null;
      row.match.confidence_status = "calibrated_medium";
    }
  }
  recommendationRows.sort((left, right) => right.rank_score - left.rank_score);
}

function persistResumeEvidence(analysis: ReturnType<typeof analyzeResumeText>) {
  for (const item of analysis.skills) upsertEvidence(item.skill, false);
  refreshRecommendationScores();
  activityDelta.candidate_documents += 1;
  activityDelta.audit_events += 2;
  pushNotification({
    role: "candidate",
    type: "evidence.resume_analyzed",
    title: "Resume evidence added",
    message: `${analysis.skills.length} job-related claims were added and every recommendation was recalculated.`,
  });
}

function parseBody(init: RequestInit): Record<string, unknown> {
  if (typeof init.body !== "string") return {};
  try { return JSON.parse(init.body) as Record<string, unknown>; } catch { return {}; }
}

function analyzeResumeText(text: string) {
  const lower = text.toLowerCase();
  const catalogue = ["Python", "FastAPI", "SQL", "Machine learning", "Docker", "Natural language processing"];
  const detected = catalogue.filter(skill => lower.includes(skill.toLowerCase()));
  const skills = (detected.length ? detected : ["Python", "SQL", "Machine learning"]).slice(0, 6).map((skill, index) => ({
    skill,
    confidence: Math.max(0.71, 0.93 - index * 0.05),
    evidence_excerpt: `Resume text contains job-related evidence for ${skill}.`,
    source_locator: `paragraph:${index + 1}`,
  }));
  return {
    skills,
    summary: `Extracted ${skills.length} job-related skill claims. Sensitive and protected attributes were excluded.`,
    quality_warnings: ["Self-reported claims remain unverified until supported by an assessment, project, or human review."],
    language_codes: ["en"],
  };
}

export function demoSessionFor(role: DemoRole) {
  const users = {
    candidate: { id: "demo-candidate", email: "candidate@quickhire.demo", full_name: "Aarav Mehta", role: "candidate" as const, email_verified: true },
    recruiter: { id: "demo-recruiter", email: "recruiter@quickhire.demo", full_name: "Priya Sharma", role: "recruiter" as const, email_verified: true },
    admin: { id: "demo-admin", email: "admin@quickhire.demo", full_name: "Platform Reviewer", role: "admin" as const, email_verified: true },
  };
  return { access_token: `demo-${role}-access`, token_type: "bearer", expires_in: 3600, user: users[role] };
}

export async function demoApi(path: string, init: RequestInit = {}): Promise<unknown> {
  await delay();
  const method = (init.method ?? "GET").toUpperCase();
  const body = parseBody(init);

  if (path === "/auth/config") return { google_enabled: false, google_client_id: null, access_token_minutes: 15, refresh_token_days: 14 };
  if (path === "/auth/refresh") throw new Error("No active demo session");
  if (path === "/auth/login" || path === "/auth/register" || path === "/auth/google") {
    const role = body.role === "recruiter" ? "recruiter" : "candidate";
    return demoSessionFor(role);
  }
  if (path === "/auth/google/link" || path === "/auth/logout") return undefined;

  if (path === "/candidates/me/evidence") return clone(evidence);
  if (path === "/recommendations/me/jobs") return clone(recommendationRows);
  if (path === "/applications/me") return clone(candidateApplications);
  if (path === "/applications" && method === "POST") {
    const jobId = String(body.job_id ?? "job-ai-01");
    if (!candidateApplications.some(item => item.job_id === jobId)) {
      candidateApplications = [{ id: `my-app-${candidateApplications.length + 1}`, job_id: jobId, status: "applied" }, ...candidateApplications];
      if (applicationsByJob[jobId] && !applicationsByJob[jobId].some(item => item.id === `candidate-${jobId}`)) {
        const recommendation = recommendationRows.find(item => item.job_id === jobId);
        applicationsByJob[jobId].unshift({
          id: `candidate-${jobId}`,
          candidate_label: "Candidate QH-9951",
          status: "applied",
          fit_score: recommendation?.match.score ?? 72,
          fit_confidence: recommendation?.match.confidence ?? 0.61,
          location: "Bengaluru",
          experience: "3 years",
          applied_at: "Just now",
          top_skills: evidence.slice(0, 4).map(item => item.skill),
          explanation: recommendation?.match ?? explanation(["Additional evidence"], "Review submitted evidence before choosing a next stage.", 72, 70, 71),
          human_decision_reason: null,
        });
      }
      activityDelta.audit_events += 2;
      pushNotification({ role: "candidate", type: "application.submitted", title: "Application submitted", message: "Your evidence snapshot and current explanation were attached to the application." });
      pushNotification({ role: "recruiter", type: "application.new", title: "New applicant received", message: "A new evidence-linked application was added to the selected job pipeline." });
    }
    return clone(candidateApplications.find(item => item.job_id === jobId));
  }

  if (path === "/intelligence/resume/analyze" && method === "POST") {
    const analysis = analyzeResumeText(String(body.text ?? ""));
    if (body.persist_evidence !== false) persistResumeEvidence(analysis);
    return analysis;
  }
  if (path === "/intelligence/resume/upload" && method === "POST") {
    const file = init.body instanceof FormData ? init.body.get("file") : null;
    const filename = file instanceof File ? file.name : "sample-resume.pdf";
    const analysis = analyzeResumeText("Python FastAPI SQL machine learning Docker natural language processing");
    persistResumeEvidence(analysis);
    return {
      document_id: "demo-document-01",
      filename,
      page_count: 2,
      text_length: 2841,
      language_codes: ["en"],
      security_flags: [],
      duplicate: false,
      retention_notice: "Review demo: the selected file was not uploaded or retained.",
      analysis,
    };
  }

  if (path === "/jobs/mine") return clone(jobs);
  if (path.startsWith("/applications/recruiter/jobs/")) {
    const jobId = path.split("/").at(-1) ?? "";
    return clone(applicationsByJob[jobId] ?? []);
  }
  if (path === "/intelligence/job-description/analyze" && method === "POST") {
    return {
      summary: "Created a reviewable competency rubric from job-related outcomes and responsibilities.",
      requirements: [
        { name: "Python", weight: 0.3, mandatory: true },
        { name: "Machine learning", weight: 0.3, mandatory: true },
        { name: "API design", weight: 0.22, mandatory: false },
        { name: "Model monitoring", weight: 0.18, mandatory: false },
      ],
      responsibilities: ["Build reliable AI services", "Measure and monitor model quality"],
      quality_warnings: ["Confirm each weight and mandatory requirement before publishing."],
      model_version: "quickhire-jd-baseline-0.4",
    };
  }
  if (path === "/jobs" && method === "POST") {
    const created = {
      id: `job-demo-${jobs.length + 1}`,
      title: String(body.title ?? "New role"),
      company: String(body.company ?? "Demo company"),
      description: String(body.description ?? ""),
      status: String(body.status ?? "published"),
      requirements: Array.isArray(body.requirements) ? body.requirements : [],
    };
    jobs = [created, ...jobs];
    applicationsByJob[created.id] = [];
    activityDelta.audit_events += 2;
    pushNotification({ role: "recruiter", type: "job.published", title: "Job published", message: `${created.title} is live with a reviewable competency rubric.` });
    pushNotification({ role: "admin", type: "governance.job_checked", title: "New job passed policy checks", message: `${created.title} was published after prohibited criteria were excluded.` });
    return clone(created);
  }
  const statusMatch = path.match(/^\/applications\/([^/]+)\/status$/);
  if (statusMatch && method === "PATCH") {
    for (const rows of Object.values(applicationsByJob)) {
      const row = rows.find(item => item.id === statusMatch[1]);
      if (row) {
        row.status = String(body.status ?? row.status);
        row.human_decision_reason = String(body.reason ?? "Human reviewer recorded a reason.");
        activityDelta.audit_events += 2;
        pushNotification({ role: "recruiter", type: "application.stage_changed", title: "Human stage change recorded", message: `${String(row.candidate_label ?? "Candidate")} moved to ${String(row.status).replaceAll("_", " ")} with an audit reason.` });
        pushNotification({ role: "candidate", type: "application.status_changed", title: "Application status updated", message: `A recruiter recorded a human-owned move to ${String(row.status).replaceAll("_", " ")}.` });
        return clone(row);
      }
    }
    throw new Error("Application not found in demo data");
  }

  if (/^\/assessments\/adaptive\/[^/]+$/.test(path) && method === "POST") {
    return {
      id: "demo-assessment-01",
      job_id: path.split("/").at(-1),
      status: "in_progress",
      model_version: "adaptive-check-0.4",
      questions: [
        { id: "q1", competency: "MLOps", prompt: "Which practice best detects production model drift?", options: ["Monitor input and outcome distributions", "Increase training epochs", "Remove validation data", "Store only aggregate accuracy"], difficulty: "intermediate", manual_review: false },
        { id: "q2", competency: "Model monitoring", prompt: "Which signal should trigger a review when labels arrive late?", options: ["Feature-distribution shift", "Repository star count", "Developer typing speed", "Screen brightness"], difficulty: "intermediate", manual_review: false },
        { id: "q3", competency: "System design", prompt: "Describe how you would deploy a new model version with rollback and auditability.", options: [], difficulty: "advanced", manual_review: true },
      ],
    };
  }
  if (/^\/assessments\/[^/]+\/submit$/.test(path) && method === "POST") {
    upsertEvidence("MLOps", true);
    upsertEvidence("Model monitoring", true);
    refreshRecommendationScores();
    activityDelta.completed_assessments += 1;
    activityDelta.audit_events += 2;
    pushNotification({ role: "candidate", type: "assessment.completed", title: "Verified evidence created", message: "MLOps and model-monitoring results were added; fit and confidence changed immediately." });
    return { score: 84, competency_scores: { MLOps: 0.86, "Model monitoring": 0.82 }, feedback: ["Strong monitoring fundamentals.", "Your system-design response was saved for human review and did not affect the automated score."] };
  }

  if (/^\/interviews\/mock\/[^/]+$/.test(path) && method === "POST") {
    return {
      id: "demo-interview-01",
      job_id: path.split("/").at(-1),
      status: "in_progress",
      model_version: "typed-rubric-0.4",
      input_modality: "typed_text",
      policy_version: "QH-AI-2026-01",
      notice: "Only typed answer content is reviewed against the disclosed rubric. No biometric or sensitive signals are collected.",
      questions: [
        { id: "i1", competency: "Machine learning", prompt: "Tell us about a model you improved after finding an evaluation failure.", evaluation_criteria: ["Context", "Method", "Measured result", "Reflection"] },
        { id: "i2", competency: "Reliability", prompt: "Describe a production incident and how you prevented recurrence.", evaluation_criteria: ["Situation", "Action", "Verification", "Learning"] },
      ],
    };
  }
  if (/^\/interviews\/[^/]+\/submit$/.test(path) && method === "POST") {
    upsertEvidence("Structured communication", false);
    refreshRecommendationScores();
    activityDelta.completed_mock_interviews += 1;
    activityDelta.audit_events += 2;
    pushNotification({ role: "candidate", type: "interview.feedback_ready", title: "Typed-answer feedback is ready", message: "Content-rubric feedback was added without voice, appearance, emotion, or personality analysis." });
    return {
      content_score: 82,
      rubric_scores: { Context: 88, Action: 84, Result: 78, Reflection: 77 },
      feedback: ["The examples describe clear actions and measurable outcomes.", "Strengthen the reflection by explaining what you would change next time."],
      human_review_required: true,
      input_modality: "typed_text",
      excluded_signal_categories: ["appearance", "voice", "accent", "emotion", "personality", "disability", "honesty", "protected traits"],
      policy_version: "QH-AI-2026-01",
    };
  }

  if (path === "/admin/metrics") {
    return {
      users: 1248,
      candidates: 1094,
      recruiters: 148,
      candidate_documents: 867 + activityDelta.candidate_documents,
      published_jobs: 94 + Math.max(0, jobs.length - 2),
      applications: 2361 + Math.max(0, candidateApplications.length - 2),
      completed_assessments: 712 + activityDelta.completed_assessments,
      completed_mock_interviews: 389 + activityDelta.completed_mock_interviews,
      audit_events: 18420 + activityDelta.audit_events,
      active_auth_sessions: 326 + activityDelta.active_auth_sessions,
      federated_identities: 704 + activityDelta.federated_identities,
      live_connections: 47 + Math.min(3, activityDelta.audit_events),
      model_version: "EvidenceGraph Hybrid 0.4",
      governance_policy_version: "QH-AI-2026-01",
      evaluation_state: "research_validation_required",
    };
  }
  if (path === "/admin/governance/policy") {
    return {
      policy_version: "QH-AI-2026-01",
      ai_decision_mode: "advisory_only",
      autonomous_employment_decisions: false,
      human_confirmation_required: true,
      interview_input_modalities: ["typed_text"],
      prohibited_signal_categories: ["appearance", "voice", "accent", "emotion", "personality", "disability", "honesty", "race", "religion", "sex", "age", "health", "other protected traits"],
      enforcement_points: ["job ingestion", "resume extraction", "ranking", "assessment generation", "interview feedback", "stage transition"],
    };
  }

  throw new Error(`This action is not available in the review demo (${path}).`);
}
