import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bell,
  Bot,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
  Waypoints,
} from "lucide-react";
import { Link } from "react-router-dom";
import LiveBarChart from "../components/LiveBarChart";
import { api, getSession } from "../lib/api";

type Notification = { id: string; title: string; body: string; created_at: string; read_at: string | null };
type Schedule = { id: string; job_title: string; candidate_name: string; starts_at: string; status: string };
type CandidateApplication = { id: string; job_title: string; company: string; status: string; updated_at: string };
type CandidateEvidence = { id: string; verified: boolean };
type Recommendation = {
  job_id: string;
  title: string;
  company: string;
  match: { score: number; confidence: number; next_best_actions: string[]; missing_requirements: string[] };
};
type RecruiterJob = { id: string; title: string; company: string; status: string };
type RecruiterApplication = { id: string; candidate_label: string; status: string; fit_score: number | null };
type RecruiterApplicationWithJob = RecruiterApplication & { job_title: string };
type AdminMetrics = {
  users: number;
  candidates: number;
  recruiters: number;
  published_jobs: number;
  applications: number;
  live_connections: number;
  scheduled_interviews: number;
  pending_email_deliveries: number;
  failed_email_deliveries: number;
  open_candidate_requests: number;
  audit_events: number;
  agent_runs: number;
  model_version: string;
  evaluation_state: string;
};
type CandidateRequest = { id: string; request_type: string; status: string; created_at: string };

const closedApplicationStatuses = new Set(["withdrawn", "hired", "rejected"]);

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function firstName(): string {
  return getSession()?.user.full_name.trim().split(/\s+/)[0] || "there";
}

function upcoming(rows: Schedule[]): Schedule | undefined {
  const now = Date.now();
  return rows
    .filter(row => ["proposed", "confirmed"].includes(row.status) && new Date(row.starts_at).getTime() >= now)
    .sort((left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime())[0];
}

function CandidateHome() {
  const [applications, setApplications] = useState<CandidateApplication[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [evidence, setEvidence] = useState<CandidateEvidence[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([
      api<CandidateApplication[]>("/applications/me"),
      api<Recommendation[]>("/recommendations/me/jobs?limit=6"),
      api<CandidateEvidence[]>("/candidates/me/evidence"),
      api<Schedule[]>("/interview-schedules"),
      api<Notification[]>("/notifications?unread_only=true"),
    ]).then(results => {
      if (!mounted) return;
      const [applicationResult, recommendationResult, evidenceResult, scheduleResult, notificationResult] = results;
      if (applicationResult.status === "fulfilled") setApplications(applicationResult.value);
      if (recommendationResult.status === "fulfilled") setRecommendations(recommendationResult.value);
      if (evidenceResult.status === "fulfilled") setEvidence(evidenceResult.value);
      if (scheduleResult.status === "fulfilled") setSchedules(scheduleResult.value);
      if (notificationResult.status === "fulfilled") setNotifications(notificationResult.value);
      if (results.every(result => result.status === "rejected")) setError("Your home summary could not be loaded. Try refreshing the page.");
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const activeApplications = applications.filter(item => !closedApplicationStatuses.has(item.status));
  const verifiedEvidence = evidence.filter(item => item.verified).length;
  const topMatch = recommendations[0];
  const nextInterview = upcoming(schedules);
  const stageData = useMemo(() => Object.entries(applications.reduce<Record<string, number>>((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {})).map(([label, value]) => ({ label: label.replaceAll("_", " "), value })), [applications]);
  const fitData = useMemo(() => recommendations.slice(0, 5).map(item => ({
    label: item.title,
    value: item.match.score,
    displayValue: `${Math.round(item.match.score)}%`,
  })), [recommendations]);

  return <section className="workspace workspace-home">
    <div className="home-hero candidate-home-hero">
      <div><span className="home-kicker"><Sparkles size={15} /> JOB-SEEKER HOME</span><h2>{greeting()}, {firstName()}.</h2><p>Your applications, strongest opportunities, skill evidence, interviews, and next improvement step—updated from your real workspace data.</p><div className="home-actions"><Link className="primary link-button" to="/candidate">Explore opportunities <ArrowRight size={16} /></Link><Link className="home-quiet-link" to="/candidate#resume-intelligence">Update resume evidence</Link></div></div>
      <div className="home-focus-card"><span>BEST CURRENT OPPORTUNITY</span>{topMatch ? <><strong>{topMatch.title}</strong><p>{topMatch.company}</p><div><b>{Math.round(topMatch.match.score)}%</b><small>evidence fit</small></div></> : <><strong>Build your first match</strong><p>Add job-related skills or resume evidence to activate recommendations.</p></>}</div>
    </div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="home-metric-grid" aria-busy={loading}>
      <article><Waypoints /><div><strong>{loading ? "—" : activeApplications.length}</strong><span>Active applications</span></div></article>
      <article><Target /><div><strong>{loading ? "—" : recommendations.length}</strong><span>Ranked opportunities</span></div></article>
      <article><FileCheck2 /><div><strong>{loading ? "—" : verifiedEvidence}</strong><span>Verified evidence items</span></div></article>
      <article><Bell /><div><strong>{loading ? "—" : notifications.length}</strong><span>Unread updates</span></div></article>
    </div>
    <div className="home-dashboard-grid">
      <article className="panel home-priority-panel"><div className="home-section-head"><div><span className="eyebrow">TODAY'S PRIORITIES</span><h3>What deserves attention next</h3></div><CheckCircle2 /></div>
        <div className="home-priority-list">
          <Link to="/candidate/interviews"><CalendarClock /><div><strong>{nextInterview ? `Interview · ${nextInterview.job_title}` : "No upcoming interview"}</strong><span>{nextInterview ? new Date(nextInterview.starts_at).toLocaleString() : "New proposals will appear here."}</span></div><ArrowRight /></Link>
          <Link to="/candidate"><Waypoints /><div><strong>{activeApplications[0] ? `${activeApplications[0].job_title} · ${activeApplications[0].status.replaceAll("_", " ")}` : "Start your application pipeline"}</strong><span>{activeApplications[0] ? activeApplications[0].company : "Review evidence-ranked opportunities."}</span></div><ArrowRight /></Link>
          <Link to="/candidate"><Target /><div><strong>{topMatch?.match.next_best_actions[0] ?? "Create a skill roadmap"}</strong><span>{topMatch?.match.missing_requirements.length ? `${topMatch.match.missing_requirements.length} evidence gap(s) in your leading match.` : "Your personalized gaps will appear after matching."}</span></div><ArrowRight /></Link>
        </div>
      </article>
      <article className="panel home-quick-panel"><span className="eyebrow">QUICK ACTIONS</span><h3>Move your search forward</h3><div className="home-quick-grid"><Link to="/candidate"><BriefcaseBusiness />Find jobs</Link><Link to="/candidate/messages"><MessageCircle />Messages</Link><Link to="/candidate/interviews"><CalendarClock />Interviews</Link><Link to="/notifications"><Bell />Updates</Link></div></article>
    </div>
    <div className="content-grid analytics-grid home-analytics"><LiveBarChart title="Your application stages" description="Changes whenever a candidate or human recruiter updates the live pipeline." data={stageData} /><LiveBarChart title="Top evidence-fit opportunities" description="Recalculates from current job requirements and your job-related evidence." data={fitData} /></div>
  </section>;
}

function RecruiterHome() {
  const [jobs, setJobs] = useState<RecruiterJob[]>([]);
  const [applications, setApplications] = useState<RecruiterApplicationWithJob[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [jobResult, scheduleResult, notificationResult] = await Promise.all([
          api<RecruiterJob[]>("/jobs/mine"),
          api<Schedule[]>("/interview-schedules"),
          api<Notification[]>("/notifications?unread_only=true"),
        ]);
        const applicationGroups = await Promise.all(jobResult.map(job =>
          api<RecruiterApplication[]>(`/applications/recruiter/jobs/${job.id}`)
            .then(items => items.map(item => ({ ...item, job_title: job.title })))
            .catch(() => [] as RecruiterApplicationWithJob[])
        ));
        if (!mounted) return;
        setJobs(jobResult); setSchedules(scheduleResult); setNotifications(notificationResult); setApplications(applicationGroups.flat());
      } catch (reason) {
        if (mounted) setError(reason instanceof Error ? reason.message : "Your recruiter home could not be loaded.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const publishedJobs = jobs.filter(job => job.status === "published").length;
  const needsReview = applications.filter(item => ["applied", "under_review"].includes(item.status));
  const nextInterview = upcoming(schedules);
  const jobData = useMemo(() => jobs.map(job => ({
    label: job.title,
    value: applications.filter(item => item.job_title === job.title).length,
  })).slice(0, 6), [applications, jobs]);
  const pipelineData = useMemo(() => Object.entries(applications.reduce<Record<string, number>>((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {})).map(([label, value]) => ({ label: label.replaceAll("_", " "), value })), [applications]);

  return <section className="workspace workspace-home">
    <div className="home-hero recruiter-home-hero"><div><span className="home-kicker"><BriefcaseBusiness size={15} /> RECRUITER HOME</span><h2>{greeting()}, {firstName()}.</h2><p>A live overview of your openings, applicants, interviews, messages, and human review priorities—without turning AI suggestions into hiring decisions.</p><div className="home-actions"><Link className="primary link-button" to="/recruiter">Manage jobs and applicants <ArrowRight size={16} /></Link><Link className="home-quiet-link" to="/recruiter/assistant">Ask recruiter assistant</Link></div></div><div className="home-focus-card"><span>HUMAN REVIEW QUEUE</span><strong>{loading ? "Loading…" : `${needsReview.length} applicant${needsReview.length === 1 ? "" : "s"}`}</strong><p>Need evidence review or a recorded human decision.</p><div><b>{publishedJobs}</b><small>published jobs</small></div></div></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="home-metric-grid" aria-busy={loading}><article><BriefcaseBusiness /><div><strong>{loading ? "—" : publishedJobs}</strong><span>Published jobs</span></div></article><article><UsersRound /><div><strong>{loading ? "—" : applications.length}</strong><span>Total applicants</span></div></article><article><CalendarClock /><div><strong>{loading ? "—" : schedules.filter(row => ["proposed", "confirmed"].includes(row.status)).length}</strong><span>Open interviews</span></div></article><article><Bell /><div><strong>{loading ? "—" : notifications.length}</strong><span>Unread updates</span></div></article></div>
    <div className="home-dashboard-grid"><article className="panel home-priority-panel"><div className="home-section-head"><div><span className="eyebrow">REVIEW PRIORITIES</span><h3>Human actions waiting for you</h3></div><UsersRound /></div><div className="home-priority-list"><Link to="/recruiter"><UsersRound /><div><strong>{needsReview[0] ? `${needsReview[0].candidate_label} · ${needsReview[0].job_title}` : "No unreviewed applicants"}</strong><span>{needsReview[0] ? `Current stage: ${needsReview[0].status.replaceAll("_", " ")}` : "New applications will appear here."}</span></div><ArrowRight /></Link><Link to="/recruiter/interviews"><CalendarClock /><div><strong>{nextInterview ? `Next interview · ${nextInterview.job_title}` : "No upcoming interview"}</strong><span>{nextInterview ? `${nextInterview.candidate_name} · ${new Date(nextInterview.starts_at).toLocaleString()}` : "Propose times from an applicant record."}</span></div><ArrowRight /></Link><Link to="/recruiter/assistant"><Bot /><div><strong>Prepare an evidence-grounded review</strong><span>The assistant cites job and candidate evidence but never changes a stage.</span></div><ArrowRight /></Link></div></article><article className="panel home-quick-panel"><span className="eyebrow">QUICK ACTIONS</span><h3>Run the hiring workflow</h3><div className="home-quick-grid"><Link to="/recruiter"><BriefcaseBusiness />Post a job</Link><Link to="/recruiter/assistant"><Bot />AI assistant</Link><Link to="/recruiter/messages"><MessageCircle />Messages</Link><Link to="/recruiter/interviews"><CalendarClock />Scheduling</Link></div></article></div>
    <div className="content-grid analytics-grid home-analytics"><LiveBarChart title="Applicants by opening" description="Counts come from applicants attached to your current job records." data={jobData} /><LiveBarChart title="Your hiring pipeline" description="Reflects only human-confirmed application stages." data={pipelineData} /></div>
  </section>;
}

function AdminHome() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [requests, setRequests] = useState<CandidateRequest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    Promise.all([api<AdminMetrics>("/admin/metrics"), api<CandidateRequest[]>("/candidate-requests"), api<Notification[]>("/notifications?unread_only=true")])
      .then(([metricResult, requestResult, notificationResult]) => { if (mounted) { setMetrics(metricResult); setRequests(requestResult); setNotifications(notificationResult); } })
      .catch(reason => { if (mounted) setError(reason instanceof Error ? reason.message : "Your platform home could not be loaded."); });
    return () => { mounted = false; };
  }, []);

  const operationalData = metrics ? [
    { label: "Candidates", value: metrics.candidates },
    { label: "Recruiters", value: metrics.recruiters },
    { label: "Jobs", value: metrics.published_jobs },
    { label: "Applications", value: metrics.applications },
    { label: "Interviews", value: metrics.scheduled_interviews },
    { label: "Agent runs", value: metrics.agent_runs },
  ] : [];
  const openRequests = requests.filter(item => ["submitted", "in_review"].includes(item.status));

  return <section className="workspace workspace-home">
    <div className="home-hero admin-home-hero"><div><span className="home-kicker"><ShieldCheck size={15} /> PLATFORM HOME</span><h2>{greeting()}, {firstName()}.</h2><p>Your operational entry point for platform health, candidate recourse, model governance, notification delivery, and audited human decision controls.</p><div className="home-actions"><Link className="primary link-button" to="/admin">Open governance console <ArrowRight size={16} /></Link><Link className="home-quiet-link" to="/notifications">Review platform alerts</Link></div></div><div className="home-focus-card"><span>PLATFORM STATE</span><strong>{metrics?.evaluation_state.replaceAll("_", " ") ?? "Loading…"}</strong><p>{metrics?.model_version ?? "Loading model registry"}</p><div><b>{metrics?.live_connections ?? "—"}</b><small>live connections</small></div></div></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="home-metric-grid"><article><UsersRound /><div><strong>{metrics?.users ?? "—"}</strong><span>Total users</span></div></article><article><Waypoints /><div><strong>{metrics?.applications ?? "—"}</strong><span>Applications</span></div></article><article><Activity /><div><strong>{metrics?.audit_events ?? "—"}</strong><span>Audit events</span></div></article><article><Bell /><div><strong>{notifications.length}</strong><span>Unread alerts</span></div></article></div>
    <div className="home-dashboard-grid"><article className="panel home-priority-panel"><div className="home-section-head"><div><span className="eyebrow">OPERATIONAL PRIORITIES</span><h3>Trust and delivery work queue</h3></div><ShieldCheck /></div><div className="home-priority-list"><Link to="/admin"><UsersRound /><div><strong>{openRequests.length} candidate request{openRequests.length === 1 ? "" : "s"} need human handling</strong><span>Corrections, appeals, accommodations, exports, or deletion requests.</span></div><ArrowRight /></Link><Link to="/admin"><Bell /><div><strong>{metrics ? `${metrics.pending_email_deliveries} pending · ${metrics.failed_email_deliveries} failed deliveries` : "Loading delivery health"}</strong><span>Review the durable notification outbox before failures accumulate.</span></div><ArrowRight /></Link><Link to="/admin"><ShieldCheck /><div><strong>Inspect model and policy state</strong><span>AI remains advisory; autonomous hiring-stage changes are disabled.</span></div><ArrowRight /></Link></div></article><article className="panel home-quick-panel"><span className="eyebrow">QUICK ACTIONS</span><h3>Operate the platform</h3><div className="home-quick-grid"><Link to="/admin"><ShieldCheck />Governance</Link><Link to="/admin"><UsersRound />User requests</Link><Link to="/notifications"><Bell />Alerts</Link><Link to="/account"><CheckCircle2 />Account safety</Link></div></article></div>
    <div className="home-analytics"><LiveBarChart title="Live platform activity" description="Every value is calculated from the current database when this home page opens." data={operationalData} /></div>
  </section>;
}

export default function WorkspaceHomePage() {
  const role = getSession()?.user.role;
  if (role === "candidate") return <CandidateHome />;
  if (role === "recruiter") return <RecruiterHome />;
  if (role === "admin") return <AdminHome />;
  return <section className="workspace"><div className="empty-state"><ShieldCheck /><h3>Secure home unavailable</h3><p>Sign in again to restore your role-specific perspective.</p></div></section>;
}
