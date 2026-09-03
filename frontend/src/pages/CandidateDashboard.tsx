import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowUpRight, FileCheck2, MessagesSquare, ScanSearch, Target } from "lucide-react";
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
    requirements: MatchRequirement[];
    missing_requirements: string[];
    next_best_actions: string[];
  };
};
type ResumeResult = {
  skills: { skill: string; confidence: number; evidence_excerpt: string }[];
  summary: string;
  quality_warnings: string[];
};

export default function CandidateDashboard() {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [resumeText, setResumeText] = useState("");
  const [resumeResult, setResumeResult] = useState<ResumeResult | null>(null);
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
    if (recommendationResult.status === "fulfilled") setRecommendations(recommendationResult.value);
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
  const verifiedCount = evidence.filter(item => item.verified).length;

  return (
    <section className="workspace">
      <div className="section-heading">
        <div><span className="eyebrow">JOB SEEKER</span><h2>Your evidence, opportunities and next move</h2></div>
        <a className="primary link-button" href="#resume-intelligence">Analyze resume</a>
      </div>
      {message && <div className="inline-notice" role="status">{message}</div>}
      <div className="metric-grid">
        <article><Target /><strong>{top ? `${Math.round(top.match.confidence * 100)}%` : "—"}</strong><span>Top-match confidence</span></article>
        <article><FileCheck2 /><strong>{verifiedCount}</strong><span>Verified skill signals</span></article>
        <article><MessagesSquare /><strong>{applications.length}</strong><span>Active applications</span></article>
        <article><ScanSearch /><strong>{recommendations.length}</strong><span>Evidence-ranked jobs</span></article>
      </div>

      <div className="stack-grid">
        <div className="recommendation-list">
          <div className="subheading"><div><span className="eyebrow">RECOMMENDED ROLES</span><h3>Ranked by evidence and uncertainty</h3></div></div>
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
          <span className="eyebrow">COUNTERFACTUAL PLAN</span>
          <h3>{top?.match.next_best_actions[0] ?? "Build job-related evidence"}</h3>
          <p>QuickHire shows which missing evidence could change a recommendation. A recruiter still reviews the complete context.</p>
          <div className="impact"><ArrowUpRight /> Current evidence items <strong>{evidence.length}</strong></div>
        </article>
      </div>

      <article className="panel resume-panel" id="resume-intelligence">
        <div className="subheading"><div><span className="eyebrow">RESUME INTELLIGENCE</span><h3>Turn resume text into reviewable evidence</h3></div><span className="safe-badge">Sensitive fields excluded</span></div>
        <form onSubmit={analyzeResume}>
          <label>Resume text<textarea value={resumeText} onChange={event => setResumeText(event.target.value)} minLength={80} placeholder="Paste your experience, projects, skills and measurable outcomes…" required /></label>
          <div className="form-footer"><p>Raw resume text is analyzed in the request and is not saved by this endpoint.</p><button className="primary" disabled={working}>{working ? "Analyzing…" : "Extract evidence"}</button></div>
        </form>
        {resumeResult && <div className="analysis-result"><strong>{resumeResult.summary}</strong><div>{resumeResult.skills.map(item => <span className="chip good" key={item.skill}>{item.skill} · {Math.round(item.confidence * 100)}%</span>)}</div>{resumeResult.quality_warnings.map(warning => <p key={warning}>{warning}</p>)}</div>}
      </article>
    </section>
  );
}
