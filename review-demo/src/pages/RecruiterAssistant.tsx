import { Bot, BriefcaseBusiness, CalendarDays, ClipboardCheck, FileQuestion, MessageSquareText, Send, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

type Requirement = { name: string; weight: number; mandatory: boolean };
type Job = { id: string; title: string; company: string; description: string; status: string; requirements: Requirement[] };
type Application = { id: string; candidate_label: string; status: string; fit_score: number | null; fit_confidence: number | null; top_skills?: string[]; explanation: { missing_requirements?: string[]; next_best_actions?: string[]; abstained?: boolean } };
type AssistantResult = { title: string; summary: string; bullets: string[] };

export default function RecruiterAssistant() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [error, setError] = useState("");

  const loadJobs = useCallback(async () => {
    try {
      const rows = await api<Job[]>("/jobs/mine");
      setJobs(rows);
      setSelectedJobId(current => current || rows[0]?.id || "");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load jobs"); }
  }, []);

  useEffect(() => { void loadJobs(); }, [loadJobs]);
  useEffect(() => {
    if (!selectedJobId) return;
    api<Application[]>(`/applications/recruiter/jobs/${selectedJobId}`).then(setApplications).catch(reason => setError(reason instanceof Error ? reason.message : "Unable to load applicants"));
  }, [selectedJobId]);

  const selectedJob = jobs.find(job => job.id === selectedJobId);
  const summary = useMemo(() => {
    const needsEvidence = applications.filter(item => item.explanation.abstained || (item.fit_confidence ?? 0) < .7);
    const inVerification = applications.filter(item => ["assessment", "interview"].includes(item.status));
    const decided = applications.filter(item => ["offer", "hired", "rejected"].includes(item.status));
    return { needsEvidence, inVerification, decided };
  }, [applications]);

  function answer(kind: "queue" | "evidence" | "interview" | "message" | "custom") {
    if (!selectedJob) return;
    if (kind === "queue") {
      setResult({ title: "Applicant queue summary", summary: `${applications.length} applicants are visible for ${selectedJob.title}. ${summary.needsEvidence.length} need more proof before their match can be interpreted confidently.`, bullets: [`${summary.inVerification.length} are in a skill check or interview`, `${summary.decided.length} have a recorded human outcome`, "Review candidates with low confidence before comparing scores"] });
      return;
    }
    if (kind === "evidence") {
      const missing = applications.flatMap(item => item.explanation.missing_requirements ?? []);
      const counts = [...new Set(missing)].map(skill => ({ skill, count: missing.filter(item => item === skill).length })).sort((a, b) => b.count - a.count).slice(0, 4);
      setResult({ title: "Evidence request plan", summary: "Ask only for proof that is directly connected to the published requirements.", bullets: counts.length ? counts.map(item => `${item.skill}: missing or weak for ${item.count} applicant${item.count === 1 ? "" : "s"}`) : ["No repeated evidence gap is visible", "Review individual supporting proof before any stage decision"] });
      return;
    }
    if (kind === "interview") {
      const requirements = selectedJob.requirements.slice(0, 4).map(item => item.name);
      setResult({ title: "Structured interview plan", summary: `Use the same disclosed content rubric for every ${selectedJob.title} applicant.`, bullets: requirements.map(skill => `Ask for one specific ${skill} example, the candidate's action, measurable result, and reflection`).concat("Do not analyze voice, accent, appearance, emotion, personality, disability, or honesty") });
      return;
    }
    if (kind === "message") {
      setResult({ title: "Candidate update draft", summary: `Thank you for your interest in the ${selectedJob.title} position at ${selectedJob.company}.`, bullets: ["Your application is being reviewed against the published job requirements.", "If additional job-related proof is needed, we will request it through QuickHire.", "A recruiter—not the AI assistant—will decide every next stage."] });
      return;
    }
    const lower = prompt.toLowerCase();
    if (lower.includes("interview") || lower.includes("question")) answer("interview");
    else if (lower.includes("message") || lower.includes("email") || lower.includes("candidate")) answer("message");
    else if (lower.includes("gap") || lower.includes("skill") || lower.includes("evidence") || lower.includes("proof")) answer("evidence");
    else answer("queue");
  }

  function ask(event: FormEvent) {
    event.preventDefault();
    answer("custom");
  }

  return (
    <section className="workspace recruiter-assistant-page">
      <div className="section-heading"><div><span className="eyebrow">AI RECRUITER ASSISTANT</span><h2>Prepare better reviews without giving AI hiring authority</h2></div><Link className="secondary link-button" to="/recruiter"><UsersRound size={17} /> Open applicants</Link></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="assistant-boundary"><ShieldCheck /><div><strong>This assistant may summarize, draft, and suggest.</strong><p>It cannot reject, shortlist, offer, hire, or move any applicant. A recruiter must inspect the job-related proof and confirm every stage change.</p></div></div>
      <div className="assistant-layout">
        <aside className="panel assistant-context">
          <span className="eyebrow">WORKING CONTEXT</span>
          <label>Job<select value={selectedJobId} onChange={event => { setSelectedJobId(event.target.value); setResult(null); }}>{jobs.map(job => <option value={job.id} key={job.id}>{job.title}</option>)}</select></label>
          <div className="assistant-context-metrics"><div><UsersRound /><strong>{applications.length}</strong><span>Applicants</span></div><div><FileQuestion /><strong>{summary.needsEvidence.length}</strong><span>Need more proof</span></div><div><ClipboardCheck /><strong>{summary.inVerification.length}</strong><span>In verification</span></div></div>
          {selectedJob && <div className="assistant-requirements"><strong>Published requirements</strong>{selectedJob.requirements.map(item => <span key={item.name}>{item.name}{item.mandatory ? " · required" : ""}</span>)}</div>}
        </aside>
        <div className="assistant-main">
          <div className="assistant-actions">
            <button type="button" onClick={() => answer("queue")}><UsersRound /><span><strong>Summarize queue</strong><small>Workload, stages and low-confidence cases</small></span></button>
            <button type="button" onClick={() => answer("evidence")}><FileQuestion /><span><strong>Find proof gaps</strong><small>Common missing job requirements</small></span></button>
            <button type="button" onClick={() => answer("interview")}><CalendarDays /><span><strong>Build interview plan</strong><small>Consistent typed-content rubric</small></span></button>
            <button type="button" onClick={() => answer("message")}><MessageSquareText /><span><strong>Draft candidate update</strong><small>Clear and neutral communication</small></span></button>
          </div>
          <article className="panel assistant-response">
            <div className="assistant-response-head"><span><Bot /> QuickHire assistant</span><small>Advisory output · verify before use</small></div>
            {result ? <div className="assistant-answer"><Sparkles /><div><h3>{result.title}</h3><p>{result.summary}</p><ul>{result.bullets.map(item => <li key={item}>{item}</li>)}</ul></div></div> : <div className="assistant-empty"><Bot /><h3>Choose a task or ask a question</h3><p>The response will use the selected job and the current applicant queue.</p></div>}
            <form className="assistant-prompt" onSubmit={ask}><input value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Ask about proof gaps, interview questions, or candidate communication…" required /><button className="primary" aria-label="Ask recruiter assistant"><Send size={18} /></button></form>
          </article>
        </div>
      </div>
    </section>
  );
}
