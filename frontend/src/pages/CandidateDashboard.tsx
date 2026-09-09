import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowUpRight, FileCheck2, FileText, MessagesSquare, ScanSearch, Target, UploadCloud } from "lucide-react";
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
      setMessage(result.duplicate ? "This document was already analyzed; its existing evidence was reused." : "Document analyzed and provenance-linked evidence added.");
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
          <span className="eyebrow">COUNTERFACTUAL PLAN</span>
          <h3>{top?.match.next_best_actions[0] ?? "Build job-related evidence"}</h3>
          <p>QuickHire shows which missing evidence could change a recommendation. A recruiter still reviews the complete context.</p>
          <div className="impact"><ArrowUpRight /> Current evidence items <strong>{evidence.length}</strong></div>
        </article>
      </div>

      <article className="panel resume-panel" id="resume-intelligence">
        <div className="subheading"><div><span className="eyebrow">DOCUMENT INTELLIGENCE</span><h3>Turn a resume into provenance-linked evidence</h3></div><span className="safe-badge">Sensitive fields excluded</span></div>
        <div className="resume-input-grid">
          <form className="upload-card" onSubmit={uploadResume}>
            <UploadCloud size={28} />
            <h4>Upload resume</h4>
            <p>PDF, DOCX or TXT · maximum 5 MB · up to 30 PDF pages</p>
            <label className="file-picker"><input type="file" accept=".pdf,.docx,.txt" onChange={event => setResumeFile(event.target.files?.[0] ?? null)} required /><span>{resumeFile?.name ?? "Choose document"}</span></label>
            <button className="primary" disabled={working || !resumeFile}>{working ? "Analyzing…" : "Extract with provenance"}</button>
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
