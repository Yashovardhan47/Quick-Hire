import { useEffect, useState } from "react";
import { Activity, ClipboardCheck, Scale, ShieldAlert, UsersRound, Waypoints } from "lucide-react";
import { api } from "../lib/api";

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
  model_version: string;
  evaluation_state: string;
};

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

  useEffect(() => {
    Promise.all([api<Metrics>("/admin/metrics"), api<AIPolicy>("/admin/ai-policy")])
      .then(([metricResult, policyResult]) => { setMetrics(metricResult); setPolicy(policyResult); })
      .catch(reason => setError(reason instanceof Error ? reason.message : "Unable to load governance controls"));
  }, []);

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
      <div className="content-grid">
        <article className="panel">
          <span className="eyebrow">MODEL REGISTRY</span><h3>{metrics?.model_version ?? "EvidenceGraph baseline"}</h3>
          <p>Deterministic evidence scoring · versioned explanations · protected features excluded.</p>
          <div className="audit-row"><span>Evaluation state</span><strong>{metrics?.evaluation_state.replaceAll("_", " ") ?? "Loading"}</strong></div>
          <div className="audit-row"><span>Active guardrail policy</span><strong>{policy?.version ?? "Loading"}</strong></div>
          <div className="audit-row"><span>Completed mock interviews</span><strong>{metrics?.completed_mock_interviews ?? "—"}</strong></div>
          <div className="audit-row"><span>Recorded audit events</span><strong>{metrics?.audit_events ?? "—"}</strong></div>
        </article>
        <article className="panel">
          <span className="eyebrow">DECISION CONTROLS</span><h3>Enforced in this milestone</h3>
          <ul className="check-list"><li>Autonomous stage changes are disabled server-side</li><li>Human evidence review, confirmation and reason are required</li><li>Recruiters can access only applications for their jobs</li><li>Assessment answers are hidden until submission</li><li>Mock interviews use typed content and disclosed rubrics only</li></ul>
        </article>
      </div>
      <div className="content-grid governance-row">
        <article className="panel"><Scale /><h3>Blocked AI signals</h3><p>{policy ? policy.prohibited_signal_categories.map(item => item.replaceAll("_", " ")).join(" · ") : "Loading active policy…"}</p></article>
        <article className="panel"><ShieldAlert /><h3>Candidate recourse</h3><p>Add correction, appeal, accommodation, retention and deletion workflows before using the platform in consequential hiring.</p></article>
      </div>
    </section>
  );
}
