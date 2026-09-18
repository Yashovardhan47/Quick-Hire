import { FormEvent, useCallback, useEffect, useState } from "react";
import { Bot, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";

type Job = { id: string; title: string };
type Application = { id: string; candidate_label: string; status: string };
type AssistantResponse = { action: string; title: string; summary: string; items: string[]; warnings: string[]; decision_notice: string };
type CopilotResult = {
  answer: string;
  interpreted_intent: string;
  candidates: { application_id: string; candidate_label: string; status: string; fit_score: number | null; fit_confidence: number | null; matched_requirements: string[]; missing_requirements: string[] }[];
  evidence_notes: string[];
  agent_trace: { agent: string; status: string; detail: string }[];
  warnings: string[];
};

export default function RecruiterAssistantPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationId, setApplicationId] = useState("");
  const [action, setAction] = useState("queue_summary");
  const [result, setResult] = useState<AssistantResponse | null>(null);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [chatResult, setChatResult] = useState<CopilotResult | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => { api<Job[]>("/jobs/mine").then(rows => { setJobs(rows); setJobId(rows[0]?.id ?? ""); }).catch(reason => setStatus(reason.message)); }, []);
  const loadApplications = useCallback(async (selectedJob: string) => {
    if (!selectedJob) { setApplications([]); return; }
    try { const rows = await api<Application[]>(`/applications/recruiter/jobs/${selectedJob}`); setApplications(rows); setApplicationId(rows[0]?.id ?? ""); }
    catch (reason) { setStatus(reason instanceof Error ? reason.message : "Unable to load applications"); }
  }, []);
  useEffect(() => { void loadApplications(jobId); }, [jobId, loadApplications]);

  async function run() {
    try {
      setStatus("");
      setResult(await api<AssistantResponse>(`/recruiter-assistant/jobs/${jobId}`, { method: "POST", body: JSON.stringify({ action, application_id: action === "queue_summary" ? null : applicationId }) }));
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Assistant request failed"); }
  }

  async function askCopilot(event: FormEvent) {
    event.preventDefault();
    if (!jobId || query.trim().length < 3) return;
    setWorking(true);
    try {
      setStatus("");
      setChatResult(await api<CopilotResult>(`/recruiter-assistant/jobs/${jobId}/chat`, {
        method: "POST",
        body: JSON.stringify({ message: query, application_id: null }),
      }));
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Copilot request failed"); }
    finally { setWorking(false); }
  }

  return <section className="workspace"><div className="section-heading"><div><span className="eyebrow">RECRUITER ASSISTANT</span><h2>Prepare reviews without outsourcing decisions</h2></div><span className="safe-badge"><ShieldCheck size={15} /> Advisory only</span></div>
    {status && <div className="inline-notice" role="status">{status}</div>}
    <div className="assistant-layout"><article className="panel assistant-controls"><Bot size={28} /><h3>Choose a review task</h3><label>Job<select value={jobId} onChange={event => setJobId(event.target.value)}>{jobs.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label><label>Task<select value={action} onChange={event => setAction(event.target.value)}><option value="queue_summary">Summarize real applicant queue</option><option value="evidence_gaps">Review evidence gaps</option><option value="interview_plan">Draft structured interview plan</option><option value="candidate_update">Draft candidate update</option></select></label>{action !== "queue_summary" && <label>Application<select value={applicationId} onChange={event => setApplicationId(event.target.value)}>{applications.map(item => <option key={item.id} value={item.id}>{item.candidate_label} · {item.status.replaceAll("_", " ")}</option>)}</select></label>}<button className="primary" disabled={!jobId || (action !== "queue_summary" && !applicationId)} onClick={() => void run()}>Generate advisory output</button></article>
      <article className="panel assistant-result">{result ? <><span className="eyebrow">{result.action.replaceAll("_", " ")}</span><h3>{result.title}</h3><p>{result.summary}</p><ul className="check-list">{result.items.map(item => <li key={item}>{item}</li>)}</ul><div className="assistant-warning">{result.warnings.map(item => <p key={item}>{item}</p>)}</div></> : <div className="empty-state"><Bot /><h3>Nothing generated yet</h3><p>The assistant reads only the selected job and its authorized application evidence.</p></div>}</article></div>
    <article className="panel copilot-chat"><div className="subheading"><div><span className="eyebrow">NATURAL-LANGUAGE HR COPILOT</span><h3>Search the authorized applicant queue in plain language</h3></div><ShieldCheck /></div><p className="muted">Try “show Python applicants above 70”, “which records need SQL evidence?”, or “summarize candidates in interview”. The copilot cannot change a stage.</p><form onSubmit={askCopilot}><label>Recruiter question<textarea value={query} onChange={event => setQuery(event.target.value)} minLength={3} maxLength={2000} placeholder="Search job requirements, evidence gaps, fit ranges, or human-recorded stages…" required /></label><button className="primary" disabled={!jobId || working}>{working ? "Searching…" : "Ask copilot"}</button></form>
      {chatResult && <div className="copilot-answer"><span className="eyebrow">{chatResult.interpreted_intent.replaceAll("_", " ")}</span><h3>{chatResult.answer}</h3>{chatResult.evidence_notes.map(note => <p key={note}>{note}</p>)}<div className="copilot-candidates">{chatResult.candidates.map(candidate => <article key={candidate.application_id}><div><strong>{candidate.candidate_label}</strong><span className="status">{candidate.status.replaceAll("_", " ")}</span></div><p>{Math.round(candidate.fit_score ?? 0)}% fit · {Math.round((candidate.fit_confidence ?? 0) * 100)}% confidence</p><small>Supported: {candidate.matched_requirements.join(", ") || "review citations"}</small><small>Needs evidence: {candidate.missing_requirements.join(", ") || "none recorded"}</small></article>)}</div><details className="grounding-details"><summary>Agent trace</summary>{chatResult.agent_trace.map((step, index) => <p key={`${step.agent}-${index}`}><strong>{step.agent.replaceAll("_", " ")}</strong>: {step.detail}</p>)}</details><div className="assistant-warning">{chatResult.warnings.map(item => <p key={item}>{item}</p>)}</div></div>}
    </article>
  </section>;
}
