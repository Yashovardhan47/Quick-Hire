import { useEffect, useState } from "react";
import { Activity, ClipboardCheck, Scale, ShieldAlert, UsersRound, Waypoints } from "lucide-react";
import { api } from "../lib/api";
import LiveBarChart from "../components/LiveBarChart";

type Metrics = {
  users: number;
  candidates: number;
  recruiters: number;
  candidate_documents: number;
  published_jobs: number;
  applications: number;
  completed_assessments: number;
  completed_mock_interviews: number;
  audit_events: number;
  live_connections: number;
  messages: number;
  scheduled_interviews: number;
  pending_email_deliveries: number;
  failed_email_deliveries: number;
  open_candidate_requests: number;
  knowledge_chunks: number;
  agent_runs: number;
  model_version: string;
  evaluation_state: string;
};

type CandidateRequest = { id: string; candidate_id: string; request_type: string; details: string; status: string; resolution: string; created_at: string };

type AIPolicy = {
  version: string;
  decision_authority: string;
  interview_input_mode: string;
  autonomous_stage_changes_allowed: false;
  prohibited_signal_categories: string[];
  enforcement_points: string[];
};

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [policy, setPolicy] = useState<AIPolicy | null>(null);
  const [error, setError] = useState("");
  const [requests, setRequests] = useState<CandidateRequest[]>([]);
  const [resolution, setResolution] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([api<Metrics>("/admin/metrics"), api<AIPolicy>("/admin/ai-policy"), api<CandidateRequest[]>("/candidate-requests")])
      .then(([metricResult, policyResult, requestResult]) => { setMetrics(metricResult); setPolicy(policyResult); setRequests(requestResult); })
      .catch(reason => setError(reason instanceof Error ? reason.message : "Unable to load governance controls"));
  }, []);

  async function updateRequest(id: string, status: "in_review" | "resolved" | "denied") {
    try {
      const updated = await api<CandidateRequest>(`/candidate-requests/${id}`, { method: "PATCH", body: JSON.stringify({ status, resolution: resolution[id] ?? "" }) });
      setRequests(current => current.map(item => item.id === id ? updated : item));
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update request"); }
  }

  return (
    <section className="workspace">
      <div className="section-heading">
        <div><span className="eyebrow">PLATFORM ADMIN</span><h2>Trust, model quality and workflow health</h2></div>
        <span className="safe-badge">Live governance view</span>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="metric-grid">
        <article><UsersRound /><strong>{metrics?.users ?? "—"}</strong><span>Total users</span></article>
        <article><Waypoints /><strong>{metrics?.applications ?? "—"}</strong><span>Applications</span></article>
        <article><ClipboardCheck /><strong>{metrics?.candidate_documents ?? "—"}</strong><span>Resume documents</span></article>
        <article><Activity /><strong>{metrics?.live_connections ?? "—"}</strong><span>Live connections</span></article>
      </div>
      <div className="analytics-grid admin-analytics">
        <LiveBarChart title="Platform activity" description="Live database totals for operations monitoring; values refresh whenever this workspace is opened." data={metrics ? [
          { label: "Candidates", value: metrics.candidates },
          { label: "Recruiters", value: metrics.recruiters },
          { label: "Published jobs", value: metrics.published_jobs },
          { label: "Applications", value: metrics.applications },
          { label: "Messages", value: metrics.messages },
          { label: "Interviews", value: metrics.scheduled_interviews },
          { label: "Agent runs", value: metrics.agent_runs },
        ] : []} />
      </div>
      <div className="content-grid">
        <article className="panel">
          <span className="eyebrow">MODEL REGISTRY</span><h3>{metrics?.model_version ?? "EvidenceGraph baseline"}</h3>
          <p>Deterministic evidence scoring · versioned explanations · protected features excluded.</p>
          <div className="audit-row"><span>Evaluation state</span><strong>{metrics?.evaluation_state.replaceAll("_", " ") ?? "Loading"}</strong></div>
          <div className="audit-row"><span>Active guardrail policy</span><strong>{policy?.version ?? "Loading"}</strong></div>
          <div className="audit-row"><span>Completed mock interviews</span><strong>{metrics?.completed_mock_interviews ?? "—"}</strong></div>
          <div className="audit-row"><span>Recorded audit events</span><strong>{metrics?.audit_events ?? "—"}</strong></div>
          <div className="audit-row"><span>Vector knowledge chunks</span><strong>{metrics?.knowledge_chunks ?? "—"}</strong></div>
          <div className="audit-row"><span>Audited specialist-agent runs</span><strong>{metrics?.agent_runs ?? "—"}</strong></div>
          <div className="audit-row"><span>Messages / scheduled interviews</span><strong>{metrics ? `${metrics.messages} / ${metrics.scheduled_interviews}` : "—"}</strong></div>
          <div className="audit-row"><span>Email outbox pending / failed</span><strong>{metrics ? `${metrics.pending_email_deliveries} / ${metrics.failed_email_deliveries}` : "—"}</strong></div>
        </article>
        <article className="panel">
          <span className="eyebrow">DECISION CONTROLS</span><h3>Enforced in this milestone</h3>
          <ul className="check-list"><li>Autonomous stage changes are disabled server-side</li><li>Human evidence review, confirmation and reason are required</li><li>Recruiters can access only applications for their jobs</li><li>Assessment answers are hidden until submission</li><li>Mock interviews evaluate editable answer text only; optional audio is discarded after transcription</li></ul>
        </article>
      </div>
      <div className="content-grid governance-row">
        <article className="panel"><Scale /><h3>Blocked AI signals</h3><p>{policy ? policy.prohibited_signal_categories.map(item => item.replaceAll("_", " ")).join(" · ") : "Loading active policy…"}</p></article>
        <article className="panel"><ShieldAlert /><h3>Candidate recourse</h3><p>{metrics?.open_candidate_requests ?? "—"} correction, appeal, accommodation, export or deletion request(s) need human handling. Request content is excluded from AI ranking.</p></article>
      </div>
      <article className="panel admin-requests"><div className="subheading"><div><span className="eyebrow">RESTRICTED REQUEST QUEUE</span><h3>Candidate rights and accommodations</h3></div><span className="safe-badge">Admin only</span></div>{requests.map(item => <div className="request-admin-row" key={item.id}><div><strong>{item.request_type.replaceAll("_", " ")}</strong><small>{new Date(item.created_at).toLocaleString()} · candidate {item.candidate_id.slice(0, 8)}</small><p>{item.details}</p></div><div><span className="status">{item.status.replaceAll("_", " ")}</span><textarea value={resolution[item.id] ?? item.resolution} onChange={event => setResolution(current => ({ ...current, [item.id]: event.target.value }))} placeholder="Record the human resolution…" /><div className="button-row"><button className="secondary" onClick={() => void updateRequest(item.id, "in_review")}>Start review</button><button className="primary" onClick={() => void updateRequest(item.id, "resolved")}>Resolve</button><button className="secondary" onClick={() => void updateRequest(item.id, "denied")}>Deny with reason</button></div></div></div>)}{requests.length === 0 && <p className="muted">No candidate requests.</p>}</article>
    </section>
  );
}
