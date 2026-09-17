import { useCallback, useEffect, useState } from "react";
import { Bot, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";

type Job = { id: string; title: string };
type Application = { id: string; candidate_label: string; status: string };
type AssistantResponse = { action: string; title: string; summary: string; items: string[]; warnings: string[]; decision_notice: string };

export default function RecruiterAssistantPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationId, setApplicationId] = useState("");
  const [action, setAction] = useState("queue_summary");
  const [result, setResult] = useState<AssistantResponse | null>(null);
  const [status, setStatus] = useState("");

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

  return <section className="workspace"><div className="section-heading"><div><span className="eyebrow">RECRUITER ASSISTANT</span><h2>Prepare reviews without outsourcing decisions</h2></div><span className="safe-badge"><ShieldCheck size={15} /> Advisory only</span></div>
    {status && <div className="inline-notice" role="status">{status}</div>}
    <div className="assistant-layout"><article className="panel assistant-controls"><Bot size={28} /><h3>Choose a review task</h3><label>Job<select value={jobId} onChange={event => setJobId(event.target.value)}>{jobs.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label><label>Task<select value={action} onChange={event => setAction(event.target.value)}><option value="queue_summary">Summarize real applicant queue</option><option value="evidence_gaps">Review evidence gaps</option><option value="interview_plan">Draft typed interview plan</option><option value="candidate_update">Draft candidate update</option></select></label>{action !== "queue_summary" && <label>Application<select value={applicationId} onChange={event => setApplicationId(event.target.value)}>{applications.map(item => <option key={item.id} value={item.id}>{item.candidate_label} · {item.status.replaceAll("_", " ")}</option>)}</select></label>}<button className="primary" disabled={!jobId || (action !== "queue_summary" && !applicationId)} onClick={() => void run()}>Generate advisory output</button></article>
      <article className="panel assistant-result">{result ? <><span className="eyebrow">{result.action.replaceAll("_", " ")}</span><h3>{result.title}</h3><p>{result.summary}</p><ul className="check-list">{result.items.map(item => <li key={item}>{item}</li>)}</ul><div className="assistant-warning">{result.warnings.map(item => <p key={item}>{item}</p>)}</div></> : <div className="empty-state"><Bot /><h3>Nothing generated yet</h3><p>The assistant reads only the selected job and its authorized application evidence.</p></div>}</article></div>
  </section>;
}
