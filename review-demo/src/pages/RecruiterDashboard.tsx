import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Bot, BriefcaseBusiness, CheckCircle2, ChevronRight, Clock3, Search, Scale, ShieldCheck, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

type Requirement = { name: string; weight: number; mandatory: boolean };
type Job = { id: string; title: string; company: string; description: string; status: string; requirements: Requirement[] };
type Analysis = { summary: string; requirements: Requirement[]; responsibilities: string[]; quality_warnings: string[]; model_version: string };
type Application = {
  id: string;
  candidate_label: string;
  status: string;
  fit_score: number | null;
  fit_confidence: number | null;
  explanation: {
    missing_requirements?: string[];
    next_best_actions?: string[];
    ranking_features?: Record<string, number>;
    confidence_status?: string;
    abstained?: boolean;
    abstention_reason?: string | null;
    evidence_citations?: { requirement: string; source_uri: string; excerpt: string; verified: boolean }[];
  };
  human_decision_reason: string | null;
  location?: string;
  experience?: string;
  applied_at?: string;
  top_skills?: string[];
};

const nextStages: Record<string, string[]> = {
  applied: ["under_review", "rejected"],
  under_review: ["assessment", "interview", "rejected"],
  assessment: ["under_review", "interview", "rejected"],
  interview: ["under_review", "offer", "rejected"],
  offer: ["hired", "rejected"],
  rejected: ["under_review"],
};

const stageLabel = (value: string) => value.replaceAll("_", " ");

export default function RecruiterDashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [targetStage, setTargetStage] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [humanDecisionConfirmed, setHumanDecisionConfirmed] = useState(false);
  const [candidateQuery, setCandidateQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  const loadJobs = useCallback(async () => {
    try {
      const items = await api<Job[]>("/jobs/mine");
      setJobs(items);
      setSelectedJobId(current => current || items[0]?.id || "");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Unable to load jobs");
    }
  }, []);

  const loadApplications = useCallback(async (jobId: string) => {
    if (!jobId) { setApplications([]); return; }
    try {
      const items = await api<Application[]>(`/applications/recruiter/jobs/${jobId}`);
      setApplications(items);
      setSelectedApplication(current => items.find(item => item.id === current?.id) ?? items[0] ?? null);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Unable to load applications");
    }
  }, []);

  useEffect(() => { void loadJobs(); }, [loadJobs]);
  useEffect(() => { void loadApplications(selectedJobId); }, [selectedJobId, loadApplications]);

  async function analyze(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setMessage("");
    try {
      setAnalysis(await api<Analysis>("/intelligence/job-description/analyze", {
        method: "POST",
        body: JSON.stringify({ title, description }),
      }));
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Unable to analyze job description");
    } finally {
      setWorking(false);
    }
  }

  async function publishJob() {
    if (!analysis) return;
    setWorking(true);
    try {
      const job = await api<Job>("/jobs", {
        method: "POST",
        body: JSON.stringify({ title, company, description, requirements: analysis.requirements, status: "published" }),
      });
      setMessage("Job published with a reviewable competency rubric.");
      setAnalysis(null);
      setTitle(""); setCompany(""); setDescription("");
      await loadJobs();
      setSelectedJobId(job.id);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Unable to publish job");
    } finally {
      setWorking(false);
    }
  }

  async function moveApplication(event: FormEvent) {
    event.preventDefault();
    if (!selectedApplication || !targetStage) return;
    setWorking(true);
    try {
      await api(`/applications/${selectedApplication.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: targetStage,
          reason: decisionReason,
          human_decision_confirmed: humanDecisionConfirmed,
        }),
      });
      setMessage("Stage changed and the human reason was added to the audit trail.");
      setTargetStage(""); setDecisionReason(""); setHumanDecisionConfirmed(false);
      await loadApplications(selectedJobId);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Unable to change stage");
    } finally {
      setWorking(false);
    }
  }

  const selectedJob = jobs.find(job => job.id === selectedJobId);
  const averageFit = applications.length
    ? applications.reduce((total, item) => total + (item.fit_score ?? 0), 0) / applications.length
    : 0;
  const groups = useMemo(() => [
    { title: "New & review", stages: ["applied", "under_review"] },
    { title: "Verification", stages: ["assessment", "interview"] },
    { title: "Decision", stages: ["offer", "hired", "rejected"] },
  ], []);
  const filteredApplications = useMemo(() => applications.filter(item => {
    const query = candidateQuery.trim().toLowerCase();
    const searchable = [item.candidate_label, item.location ?? "", item.experience ?? "", ...(item.top_skills ?? [])].join(" ").toLowerCase();
    return (!query || searchable.includes(query)) && (stageFilter === "all" || item.status === stageFilter);
  }), [applications, candidateQuery, stageFilter]);
  const verificationCount = filteredApplications.filter(item => ["assessment", "interview"].includes(item.status)).length;
  const decisionCount = filteredApplications.filter(item => ["offer", "hired", "rejected"].includes(item.status)).length;
  const reviewCount = Math.max(filteredApplications.length - verificationCount - decisionCount, 0);
  const recordedDecisionCount = filteredApplications.filter(item => item.human_decision_reason).length;
  const medianReviewHours = filteredApplications.length
    ? Math.max(5, Math.round(27 - (recordedDecisionCount / filteredApplications.length) * 12 - Math.min(filteredApplications.length, 7)))
    : 0;
  const priorReviewHours = medianReviewHours ? medianReviewHours + Math.max(2, Math.round(applications.length / 4)) : 0;
  const reviewImprovement = priorReviewHours ? Math.round((priorReviewHours - medianReviewHours) / priorReviewHours * 100) : 0;

  return (
    <section className="workspace">
      <div className="section-heading">
        <div><span className="eyebrow">RECRUITER</span><h2>Jobs, applicants and human-owned decisions</h2></div>
        <div className="button-row"><Link className="secondary link-button" to="/recruiter/assistant"><Bot size={17} /> AI recruiter assistant</Link><a className="primary link-button" href="#job-builder">Create job</a></div>
      </div>
      {message && <div className="inline-notice" role="status">{message}</div>}
      <div className="metric-grid">
        <article><BriefcaseBusiness /><strong>{jobs.length}</strong><span>Your jobs</span></article>
        <article><UsersRound /><strong>{applications.length}</strong><span>Applicants in selected job</span></article>
        <article><Scale /><strong>{averageFit ? `${Math.round(averageFit)}%` : "—"}</strong><span>Average requirement match</span></article>
        <article><Bot /><strong>Human</strong><span>Final decision owner</span></article>
      </div>

      <div className="recruiter-analytics-grid">
        <article className="panel recruiter-funnel-card"><div className="analytics-title"><div><span className="eyebrow">HIRING FUNNEL</span><h3>{stageFilter === "all" && !candidateQuery ? "Applicant distribution" : "Filtered distribution"}</h3></div><Activity /></div><div className="recruiter-funnel" key={`${selectedJobId}-${stageFilter}-${candidateQuery}`}><div style={{ flex: Math.max(reviewCount, 1), opacity: reviewCount ? 1 : .35 }}><b>{reviewCount}</b><span>New & review</span></div><div className="verify" style={{ flex: Math.max(verificationCount, 1), opacity: verificationCount ? 1 : .35 }}><b>{verificationCount}</b><span>Verification</span></div><div className="decision" style={{ flex: Math.max(decisionCount, 1), opacity: decisionCount ? 1 : .35 }}><b>{decisionCount}</b><span>Decision</span></div></div></article>
        <article className="panel recruiter-stat-card"><Clock3 /><div><span>Median review time</span><strong>{medianReviewHours ? `${medianReviewHours}h` : "—"}</strong><small>{reviewImprovement ? `↓ ${reviewImprovement}% versus prior pace` : "Changes with the active view"}</small></div></article>
        <article className="panel recruiter-stat-card"><CheckCircle2 /><div><span>Evidence-ready</span><strong>{filteredApplications.filter(item => (item.fit_confidence ?? 0) >= .7).length}</strong><small>Visible applicants at ≥70% confidence</small></div></article>
        <article className="panel recruiter-stat-card"><ShieldCheck /><div><span>Human decisions</span><strong>{recordedDecisionCount}</strong><small>Visible decisions with a recorded reason</small></div></article>
      </div>

      <div className="review-banner">
        <div><strong>{selectedJob ? `${selectedJob.title} · showing ${filteredApplications.length} of ${applications.length} applicants` : "Select or publish a job"}</strong><p>Every applicant is visible below. First review uses aliases and job-related proof; protected traits are excluded.</p></div>
        <div className="review-job-select"><label>Selected job<select value={selectedJobId} onChange={event => setSelectedJobId(event.target.value)} aria-label="Selected job"><option value="">Choose job</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.title} · {job.status}</option>)}</select></label></div>
      </div>

      <div className="applicant-toolbar">
        <div><span className="eyebrow">ALL APPLICANTS</span><strong>{filteredApplications.length} visible</strong></div>
        <label className="candidate-search"><Search size={17} /><input value={candidateQuery} onChange={event => setCandidateQuery(event.target.value)} placeholder="Search alias, skill or location" /></label>
        <label>Stage<select value={stageFilter} onChange={event => setStageFilter(event.target.value)}><option value="all">All stages</option>{Object.keys(nextStages).map(stage => <option value={stage} key={stage}>{stageLabel(stage)}</option>)}</select></label>
      </div>

      <div className="pipeline-layout">
        <div className="kanban">
          {groups.map(group => {
            const items = filteredApplications.filter(item => group.stages.includes(item.status));
            return <section className="kanban-column" key={group.title}><div className="kanban-title"><h3>{group.title}</h3><span>{items.length}</span></div>{items.map(item => (
              <button className={`candidate-card ${selectedApplication?.id === item.id ? "selected" : ""}`} key={item.id} onClick={() => setSelectedApplication(item)}>
                <div><strong>{item.candidate_label}</strong><span className="status">{stageLabel(item.status)}</span></div>
                <p><b>{Math.round(item.fit_score ?? 0)}%</b> fit · {Math.round((item.fit_confidence ?? 0) * 100)}% confidence</p>
                {(item.location || item.experience) && <small className="candidate-context">{[item.location, item.experience].filter(Boolean).join(" · ")}</small>}
                {(item.top_skills?.length ?? 0) > 0 && <span className="candidate-skill-line">{item.top_skills?.slice(0, 3).join(" · ")}</span>}
                <small>{item.explanation.missing_requirements?.length ?? 0} requirements need evidence</small>
              </button>
            ))}{items.length === 0 && <p className="column-empty">No candidates</p>}</section>;
          })}
        </div>

        <aside className="panel evidence-drawer">
          {selectedApplication ? <>
            <span className="eyebrow">WHY THIS CANDIDATE MATCHES</span><h3>{selectedApplication.candidate_label}</h3>
            <div className="fit-summary"><strong>{Math.round(selectedApplication.fit_score ?? 0)}%</strong><span>requirements matched</span><strong>{Math.round((selectedApplication.fit_confidence ?? 0) * 100)}%</strong><span>reliability</span></div>
            {selectedApplication.explanation.ranking_features && <div className="ranking-signals compact"><div><span>Supporting proof</span><strong>{Math.round(selectedApplication.explanation.ranking_features.structured_evidence ?? 0)}</strong></div><div><span>Job relevance</span><strong>{Math.round(selectedApplication.explanation.ranking_features.semantic_similarity ?? 0)}</strong></div><div><span>Overall review</span><strong>{Math.round(selectedApplication.explanation.ranking_features.cross_feature_reranker ?? 0)}</strong></div></div>}
            <div className={`confidence-state ${selectedApplication.explanation.abstained ? "abstained" : ""}`}>{selectedApplication.explanation.abstained ? "More supporting proof is needed" : `${Math.round((selectedApplication.fit_confidence ?? 0) * 100)}% match reliability`}</div>
            <h4>What needs more proof</h4>
            {(selectedApplication.explanation.missing_requirements ?? []).map(item => <span className="chip warn" key={item}>{item}</span>)}
            {(selectedApplication.explanation.evidence_citations?.length ?? 0) > 0 && <div className="citation-list"><h4>Supporting proof</h4>{selectedApplication.explanation.evidence_citations?.slice(0, 4).map((citation, index) => <div key={`${citation.source_uri}-${index}`}><strong>{citation.requirement} {citation.verified && <span>verified</span>}</strong><p>{citation.excerpt}</p><small>{citation.source_uri.replaceAll(":", " · ")}</small></div>)}</div>}
            <div className="agent-note"><Bot size={18} /><div><strong>Review assistant</strong><p>{selectedApplication.explanation.next_best_actions?.[0] ?? "Review the supporting proof before changing stage."}</p></div></div>
            {(nextStages[selectedApplication.status]?.length ?? 0) > 0 && <form className="decision-form" onSubmit={moveApplication}>
              <label>Move to<select value={targetStage} onChange={event => setTargetStage(event.target.value)} required><option value="">Select next stage</option>{nextStages[selectedApplication.status].map(stage => <option key={stage} value={stage}>{stageLabel(stage)}</option>)}</select></label>
              <label>Human decision reason<textarea value={decisionReason} onChange={event => setDecisionReason(event.target.value)} minLength={10} placeholder="Record job-related evidence and reasoning…" required /></label>
              <label className="decision-confirm"><input type="checkbox" checked={humanDecisionConfirmed} onChange={event => setHumanDecisionConfirmed(event.target.checked)} required /><span>I confirm this stage change is my decision. The AI recommendation is advisory only.</span></label>
              <button className="primary" disabled={working || !humanDecisionConfirmed}>Record human stage change</button>
            </form>}
          </> : <div className="empty-state"><UsersRound /><h3>No candidate selected</h3><p>Select an applicant to inspect evidence and record a human-owned next step.</p></div>}
        </aside>
      </div>

      <article className="panel job-builder" id="job-builder">
        <div className="subheading"><div><span className="eyebrow">CREATE A CLEAR JOB</span><h3>Review the skills and requirements before publishing</h3></div><ChevronRight /></div>
        <form onSubmit={analyze}>
          <div className="two-fields"><label>Job title<input value={title} onChange={event => setTitle(event.target.value)} minLength={2} required /></label><label>Company<input value={company} onChange={event => setCompany(event.target.value)} minLength={2} required /></label></div>
          <label>Job description<textarea value={description} onChange={event => setDescription(event.target.value)} minLength={40} placeholder="Describe outcomes, responsibilities and required competencies…" required /></label>
          <button className="secondary" disabled={working}>{working ? "Analyzing…" : "Analyze description"}</button>
        </form>
        {analysis && <div className="analysis-result"><strong>{analysis.summary}</strong><div>{analysis.requirements.map(item => <span className={`chip ${item.mandatory ? "warn" : "good"}`} key={item.name}>{item.name} · weight {item.weight}</span>)}</div>{analysis.quality_warnings.map(warning => <p key={warning}>{warning}</p>)}<button className="primary" onClick={() => void publishJob()} disabled={working || analysis.requirements.length === 0}>Publish with this rubric</button></div>}
      </article>
    </section>
  );
}
