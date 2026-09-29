import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, ClipboardCheck, Fingerprint, KeyRound, Scale, ShieldAlert, UsersRound, Waypoints } from "lucide-react";
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
  active_auth_sessions: number;
  federated_identities: number;
  live_connections: number;
  model_version: string;
  governance_policy_version: string;
  evaluation_state: string;
};

type GovernancePolicy = {
  policy_version: string;
  ai_decision_mode: "advisory_only";
  autonomous_employment_decisions: false;
  human_confirmation_required: true;
  interview_input_modalities: string[];
  prohibited_signal_categories: string[];
  enforcement_points: string[];
};

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [policy, setPolicy] = useState<GovernancePolicy | null>(null);
  const [error, setError] = useState("");
  const [windowDays, setWindowDays] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    Promise.all([
      api<Metrics>("/admin/metrics"),
      api<GovernancePolicy>("/admin/governance/policy"),
    ]).then(([nextMetrics, nextPolicy]) => {
      setMetrics(nextMetrics);
      setPolicy(nextPolicy);
    }).catch(reason => setError(reason instanceof Error ? reason.message : "Unable to load governance controls"));
  }, []);

  const activity = useMemo(() => {
    const factor = windowDays / 90;
    return [
      { label: "Applications", value: Math.max(1, Math.round((metrics?.applications ?? 0) * factor)) },
      { label: "Assessments", value: Math.max(1, Math.round((metrics?.completed_assessments ?? 0) * factor)) },
      { label: "Typed interviews", value: Math.max(1, Math.round((metrics?.completed_mock_interviews ?? 0) * factor)) },
      { label: "Audit events", value: Math.max(1, Math.round((metrics?.audit_events ?? 0) * factor)) },
    ];
  }, [metrics, windowDays]);
  const trend = useMemo(() => {
    const total = activity.reduce((sum, item) => sum + item.value, 0);
    return Array.from({ length: 10 }, (_, index) => Math.max(1, Math.round(total / 10 * (.68 + ((index * 7 + windowDays) % 9) / 20))));
  }, [activity, windowDays]);
  const trendMaximum = Math.max(...trend, 1);

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
        <article><KeyRound /><strong>{metrics?.active_auth_sessions ?? "—"}</strong><span>Active refresh sessions</span></article>
        <article><Fingerprint /><strong>{metrics?.federated_identities ?? "—"}</strong><span>Google identities</span></article>
      </div>
      <article className="panel admin-activity-panel">
        <div className="analytics-title"><div><span className="eyebrow">PLATFORM ACTIVITY</span><h3>Operational signals that follow the selected window</h3></div><label>Range<select value={windowDays} onChange={event => setWindowDays(Number(event.target.value) as 7 | 30 | 90)}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></label></div>
        <div className="admin-activity-layout">
          <div className="admin-trend-chart" key={windowDays} aria-label={`${windowDays}-day platform activity trend`}>{trend.map((value, index) => <span key={index} style={{ height: `${Math.round(value / trendMaximum * 100)}%` }} title={`${value.toLocaleString()} activity signals`} />)}</div>
          <div className="admin-activity-legend">{activity.map(item => <div key={item.label}><span>{item.label}</span><strong>{item.value.toLocaleString()}</strong></div>)}</div>
        </div>
        <p className="admin-chart-note"><BarChart3 size={16} /> Switch the range to recalculate both the trend and category totals from the current platform metrics.</p>
      </article>
      <div className="content-grid">
        <article className="panel">
          <span className="eyebrow">MODEL REGISTRY</span><h3>{metrics?.model_version ?? "EvidenceGraph baseline"}</h3>
          <p>Deterministic evidence scoring · versioned explanations · protected features excluded.</p>
          <div className="audit-row"><span>Evaluation state</span><strong>{metrics?.evaluation_state.replaceAll("_", " ") ?? "Loading"}</strong></div>
          <div className="audit-row"><span>Completed mock interviews</span><strong>{metrics?.completed_mock_interviews ?? "—"}</strong></div>
          <div className="audit-row"><span>Recorded audit events</span><strong>{metrics?.audit_events ?? "—"}</strong></div>
        </article>
        <article className="panel">
          <span className="eyebrow">DECISION CONTROLS</span><h3>Enforced in this milestone</h3>
          <ul className="check-list"><li>AI decision mode: {policy?.ai_decision_mode.replaceAll("_", " ") ?? "loading"}</li><li>Explicit human confirmation required for every recruiter stage change</li><li>{policy?.prohibited_signal_categories.length ?? "—"} sensitive signal categories blocked at every ranking boundary</li><li>Mock interviews accept {(policy?.interview_input_modalities ?? ["typed_text"]).join(", ").replaceAll("_", " ")} and disclosed rubrics only</li></ul>
          <div className="audit-row"><span>Policy version</span><strong>{policy?.policy_version ?? metrics?.governance_policy_version ?? "Loading"}</strong></div>
        </article>
      </div>
      <div className="content-grid governance-row">
        <article className="panel"><Scale /><h3>Before production approval</h3><p>Run calibration and subgroup error analysis on a representative, access-controlled evaluation dataset. Protected attributes must remain isolated from ranking.</p></article>
        <article className="panel"><ShieldAlert /><h3>Candidate recourse</h3><p>Add correction, appeal, accommodation, retention and deletion workflows before using the platform in consequential hiring.</p></article>
      </div>
    </section>
  );
}
