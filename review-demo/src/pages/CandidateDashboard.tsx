import { FormEvent, useCallback, useEffect, useState } from "react";
import { Activity, ArrowUpRight, BarChart3, CheckCircle2, ClipboardList, Clock3, FileCheck2, FileText, GraduationCap, MessagesSquare, ScanSearch, Search, Target, TrendingUp, UploadCloud, Waypoints } from "lucide-react";
import { Link } from "react-router-dom";
import FitCard from "../components/FitCard";
import { api } from "../lib/api";

type Evidence = { id: string; skill: string; verified: boolean };
type Application = { id: string; job_id: string; status: string };
type MatchRequirement = { requirement: string; coverage: number; confidence: number };
type Recommendation = {
  job_id: string;
  title: string;
  company: string;
  location: string;
  rank_score: number;
  match: {
    score: number;
    confidence: number;
    score_low: number;
    score_high: number;
    requirements: MatchRequirement[];
    missing_requirements: string[];
    next_best_actions: string[];
    ranking_features: Record<string, number>;
    confidence_status: string;
    abstained: boolean;
    abstention_reason: string | null;
    evidence_citations: { requirement: string; source_uri: string; excerpt: string; verified: boolean }[];
  };
};
type ResumeResult = {
  skills: { skill: string; confidence: number; evidence_excerpt: string; source_locator?: string | null }[];
  summary: string;
  quality_warnings: string[];
  language_codes: string[];
};
type DocumentResult = {
  document_id: string | null;
  filename: string;
  page_count: number;
  text_length: number;
  language_codes: string[];
  security_flags: string[];
  duplicate: boolean;
  retention_notice: string;
  analysis: ResumeResult;
};

export default function CandidateDashboard() {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [resumeText, setResumeText] = useState("");
  const [resumeResult, setResumeResult] = useState<ResumeResult | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [documentResult, setDocumentResult] = useState<DocumentResult | null>(null);
  const [goalId, setGoalId] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  const loadWorkspace = useCallback(async () => {
    const [evidenceResult, applicationResult, recommendationResult] = await Promise.allSettled([
      api<Evidence[]>("/candidates/me/evidence"),
      api<Application[]>("/applications/me"),
      api<Recommendation[]>("/recommendations/me/jobs"),
    ]);
    if (evidenceResult.status === "fulfilled") setEvidence(evidenceResult.value);
    if (applicationResult.status === "fulfilled") setApplications(applicationResult.value);
    if (recommendationResult.status === "fulfilled") {
      setRecommendations(recommendationResult.value);
      setGoalId(current => current || recommendationResult.value[0]?.job_id || "");
    }
  }, []);

  useEffect(() => { void loadWorkspace(); }, [loadWorkspace]);

  async function analyzeResume(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setMessage("");
    try {
      const result = await api<ResumeResult>("/intelligence/resume/analyze", {
        method: "POST",
        body: JSON.stringify({ text: resumeText, persist_evidence: true }),
      });
      setResumeResult(result);
      setMessage("Resume claims added as unverified evidence. Complete a targeted check to raise confidence.");
      await loadWorkspace();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Resume analysis failed");
    } finally {
      setWorking(false);
    }
  }

  async function uploadResume(event: FormEvent) {
    event.preventDefault();
    if (!resumeFile) return;
    setWorking(true);
    setMessage("");
    const form = new FormData();
    form.append("file", resumeFile);
    form.append("persist_evidence", "true");
    try {
      const result = await api<DocumentResult>("/intelligence/resume/upload", { method: "POST", body: form });
      setDocumentResult(result);
      setResumeResult(result.analysis);
      setMessage(result.duplicate ? "This document was already analyzed; its existing supporting proof was reused." : "Resume analyzed and job-related supporting proof added.");
      await loadWorkspace();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Document analysis failed");
    } finally {
      setWorking(false);
    }
  }

  async function apply(jobId: string) {
    setMessage("");
    try {
      await api("/applications", { method: "POST", body: JSON.stringify({ job_id: jobId }) });
      setMessage("Application submitted with its evidence explanation.");
      await loadWorkspace();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Unable to apply");
    }
  }

  const top = recommendations[0];
  const selectedGoal = recommendations.find(item => item.job_id === goalId) ?? top;
  const verifiedCount = evidence.filter(item => item.verified).length;
  const stageOrder = ["applied", "under_review", "assessment", "interview", "offer", "hired"];
  const pipelineRows = [
    { label: "Applied", count: applications.length },
    { label: "In review", count: applications.filter(item => stageOrder.indexOf(item.status) >= 1 && item.status !== "rejected").length },
    { label: "Verification", count: applications.filter(item => stageOrder.indexOf(item.status) >= 2 && item.status !== "rejected").length },
    { label: "Interview", count: applications.filter(item => stageOrder.indexOf(item.status) >= 3 && item.status !== "rejected").length },
  ];
  const pipelineMaximum = Math.max(...pipelineRows.map(item => item.count), 1);
  const targetSignals = selectedGoal?.match.requirements.map(item => ({ label: item.requirement, value: Math.round(item.coverage * 100) })) ?? [];

  return (
    <section className="workspace">
      <div className="section-heading">
        <div><span className="eyebrow">JOB SEEKER</span><h2>Your job search at a glance</h2></div>
        <a className="primary link-button" href="#resume-intelligence">Analyze resume</a>
      </div>
      {message && <div className="inline-notice" role="status">{message}</div>}
      <div className="candidate-command-bar" aria-label="Main job seeker actions">
        <Link to="/jobs"><Search /><span><strong>Find jobs</strong><small>Search QuickHire and live external listings</small></span></Link>
        <a href="#why-match"><Target /><span><strong>Why I match</strong><small>See strengths, missing skills and reliability</small></span></a>
        <a href="#improve-skills"><GraduationCap /><span><strong>Improve my skills</strong><small>Follow the shortest useful learning plan</small></span></a>
        <Link to="/candidate/applications"><ClipboardList /><span><strong>Track applications</strong><small>Follow every recruiter-owned stage update</small></span></Link>
      </div>
      <div className="metric-grid">
        <article><Target /><strong>{top ? `${Math.round(top.match.confidence * 100)}%` : "—"}</strong><span>Top match reliability</span></article>
        <article><FileCheck2 /><strong>{verifiedCount}</strong><span>Verified skills</span></article>
        <article><MessagesSquare /><strong>{applications.length}</strong><span>Active applications</span></article>
        <article><ScanSearch /><strong>{recommendations.length}</strong><span>Suggested jobs</span></article>
      </div>

      <div className="candidate-analytics-grid">
        <article className="panel evidence-coverage-panel">
          <div className="analytics-title"><div><span className="eyebrow">EVIDENCE COVERAGE</span><h3>Your profile signal</h3></div><BarChart3 /></div>
          <div className="coverage-body">
            <div className="coverage-ring" style={{ "--coverage": `${evidence.length ? Math.round(verifiedCount / evidence.length * 100) : 0}%` } as React.CSSProperties}><strong>{evidence.length ? Math.round(verifiedCount / evidence.length * 100) : 0}%</strong><span>verified</span></div>
            <div className="coverage-stats"><div><span>Verified signals</span><strong>{verifiedCount}</strong></div><div><span>Claims to verify</span><strong>{Math.max(evidence.length - verifiedCount, 0)}</strong></div><div><span>Profile evidence</span><strong>{evidence.length}</strong></div></div>
          </div>
        </article>
        <article className="panel application-funnel-panel">
          <div className="analytics-title"><div><span className="eyebrow">APPLICATION ANALYTICS</span><h3>Current pipeline</h3></div><Activity /></div>
          <div className="funnel-bars">{pipelineRows.map(item => <div key={item.label}><span>{item.label}</span><b><i style={{ width: `${Math.round(item.count / pipelineMaximum * 100)}%` }} /></b><strong>{item.count}</strong></div>)}</div>
        </article>
        <article className="panel momentum-panel">
          <div className="analytics-title"><div><span className="eyebrow">TARGET SIGNALS</span><h3>{selectedGoal?.title ?? "Evidence profile"}</h3></div><TrendingUp /></div>
          <div className="momentum-chart" key={`${selectedGoal?.job_id}-${targetSignals.map(item => item.value).join("-")}`} aria-label={`Requirement coverage for ${selectedGoal?.title ?? "selected job"}`}>{targetSignals.map(item => <span key={item.label} style={{ height: `${Math.max(item.value, 5)}%` }} title={`${item.label}: ${item.value}%`} />)}</div>
          <p><strong>{selectedGoal?.match.missing_requirements.length ?? 0} gaps</strong> for this target · change the roadmap job or complete a check to redraw this graph.</p>
        </article>
      </div>

      <div className="stack-grid" id="why-match">
        <div className="recommendation-list">
          <div className="subheading"><div><span className="eyebrow">WHY YOU MATCH</span><h3>Jobs explained by your supporting proof</h3></div></div>
          {recommendations.length === 0 && <div className="empty-state"><Target /><h3>No recommendations yet</h3><p>Analyze your resume, then ask a recruiter to publish a competency-based job.</p></div>}
          {recommendations.map(item => {
            const strengths = item.match.requirements.filter(row => row.coverage >= .45).map(row => row.requirement);
            return (
              <FitCard
                key={item.job_id}
                role={item.title}
                company={`${item.company}${item.location ? ` · ${item.location}` : ""}`}
                score={item.match.score}
                confidence={Math.round(item.match.confidence * 100)}
                scoreRange={[item.match.score_low, item.match.score_high]}
                confidenceStatus={item.match.confidence_status}
                rankingFeatures={item.match.ranking_features}
                citationCount={item.match.evidence_citations.length}
                abstained={item.match.abstained}
                strengths={strengths.slice(0, 5)}
                gaps={item.match.missing_requirements.slice(0, 5)}
                actions={<div className="button-row">
                  <button className="primary" onClick={() => void apply(item.job_id)}>Apply with evidence</button>
                  <Link className="secondary link-button" to={`/candidate/assessment/${item.job_id}`}>Targeted check</Link>
                  <Link className="text-link" to={`/candidate/interview/${item.job_id}`}>Mock interview</Link>
                </div>}
              />
            );
          })}
        </div>

        <article className="panel next-action">
          <span className="eyebrow">BEST NEXT STEP</span>
          <h3>{top?.match.next_best_actions[0] ?? "Build job-related evidence"}</h3>
          <p>QuickHire shows which missing proof could strengthen a match. A recruiter still reviews the complete application.</p>
          <div className="impact"><ArrowUpRight /> Current supporting items <strong>{evidence.length}</strong></div>
        </article>
      </div>

      {selectedGoal && <article className="panel candidate-roadmap-panel" id="improve-skills">
        <div className="subheading roadmap-dashboard-heading"><div><span className="eyebrow">HOW TO IMPROVE</span><h3>Your shortest useful plan for this job</h3></div><label>Target job<select value={selectedGoal.job_id} onChange={event => setGoalId(event.target.value)}>{recommendations.map(item => <option value={item.job_id} key={item.job_id}>{item.title}</option>)}</select></label></div>
        <div className="roadmap-dashboard-summary"><div><span className="company-mark">{selectedGoal.company.split(" ").map(word => word[0]).join("").slice(0, 2)}</span><p><small>TARGET ROLE</small><strong>{selectedGoal.title}</strong><span>{selectedGoal.company} · {selectedGoal.location}</span></p></div><div><strong>{selectedGoal.match.score}%</strong><span>current fit</span></div><div><strong>{Math.round(selectedGoal.match.confidence * 100)}%</strong><span>confidence</span></div></div>
        <div className="dashboard-roadmap-track">
          <div className="roadmap-phase complete"><span><CheckCircle2 /></span><div><small>STEP 1 · COMPLETE</small><strong>Preserve verified strengths</strong><p>{selectedGoal.match.requirements.filter(item => item.coverage >= .7).slice(0, 3).map(item => item.requirement).join(" · ") || "Core evidence collected"}</p></div></div>
          <div className="roadmap-phase active"><span><Target /></span><div><small>STEP 2 · NEXT ACTION</small><strong>{selectedGoal.match.missing_requirements[0] ? `Verify ${selectedGoal.match.missing_requirements[0]}` : "Validate the strongest evidence"}</strong><p>{selectedGoal.match.next_best_actions[0]}</p></div><Link to={`/candidate/assessment/${selectedGoal.job_id}`}>Start check</Link></div>
          <div className="roadmap-phase"><span><GraduationCap /></span><div><small>STEP 3 · BUILD EVIDENCE</small><strong>Add one proof artifact</strong><p>Connect a project, outcome, or assessment to the weakest requirement.</p></div></div>
          <div className="roadmap-phase"><span><MessagesSquare /></span><div><small>STEP 4 · PRACTICE</small><strong>Structured typed interview</strong><p>Practice job-related answers against a disclosed content rubric.</p></div><Link to={`/candidate/interview/${selectedGoal.job_id}`}>Practice</Link></div>
        </div>
        <div className="roadmap-impact"><Waypoints /><span><strong>Estimated improvement</strong> Completing the next two proof steps could make this match 6–10 points more reliable. It does not guarantee eligibility or a hiring outcome.</span><Clock3 /><b>~45 minutes</b></div>
      </article>}

      <article className="panel resume-panel" id="resume-intelligence">
        <div className="subheading"><div><span className="eyebrow">RESUME CHECK</span><h3>Turn your resume into job-related supporting proof</h3></div><span className="safe-badge">Sensitive fields excluded</span></div>
        <div className="resume-input-grid">
          <form className="upload-card" onSubmit={uploadResume}>
            <UploadCloud size={28} />
            <h4>Upload resume</h4>
            <p>PDF, DOCX or TXT · maximum 5 MB · up to 30 PDF pages</p>
            <label className="file-picker"><input type="file" accept=".pdf,.docx,.txt" onChange={event => setResumeFile(event.target.files?.[0] ?? null)} required /><span>{resumeFile?.name ?? "Choose document"}</span></label>
            <button className="primary" disabled={working || !resumeFile}>{working ? "Analyzing…" : "Analyze resume"}</button>
          </form>
          <form className="paste-card" onSubmit={analyzeResume}>
            <label>Or paste resume text<textarea value={resumeText} onChange={event => setResumeText(event.target.value)} minLength={80} placeholder="Paste experience, projects, skills and measurable outcomes…" required /></label>
            <button className="secondary" disabled={working}>{working ? "Analyzing…" : "Analyze pasted text"}</button>
          </form>
        </div>
        {documentResult && <div className="document-receipt"><FileText /><div><strong>{documentResult.filename}</strong><p>{documentResult.page_count} page(s) · {documentResult.text_length.toLocaleString()} extracted characters · languages {documentResult.language_codes.join(", ")}</p><small>{documentResult.retention_notice}</small></div>{documentResult.security_flags.length > 0 && <span className="status warning">{documentResult.security_flags.length} review flag(s)</span>}</div>}
        {resumeResult && <div className="analysis-result"><strong>{resumeResult.summary}</strong><p>Language signals: {resumeResult.language_codes.join(", ")}</p><div>{resumeResult.skills.map(item => <span className="chip good" key={item.skill}>{item.skill} · {Math.round(item.confidence * 100)}%{item.source_locator ? ` · ${item.source_locator.replace(":", " ")}` : ""}</span>)}</div>{resumeResult.quality_warnings.map(warning => <p key={warning}>{warning}</p>)}</div>}
      </article>
    </section>
  );
}
