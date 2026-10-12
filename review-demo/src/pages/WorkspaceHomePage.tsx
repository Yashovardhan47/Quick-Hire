import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bell,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  MessageSquareText,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
  Waypoints,
} from "lucide-react";
import { Link } from "react-router-dom";
import { marketplaceJobs } from "../data/marketplace";
import { api, getSession, isDemoMode, UserRole } from "../lib/api";
import { getNotifications, subscribeToNotifications } from "../lib/liveState";
import { getScheduledInterviews, subscribeToWorkflow } from "../lib/workflowState";

type Evidence = { id: string; verified: boolean };
type CandidateApplication = { id: string; job_id: string; status: string };
type Recommendation = {
  job_id: string;
  title: string;
  company: string;
  match: { score: number; confidence: number; missing_requirements: string[]; next_best_actions: string[] };
};
type RecruiterJob = { id: string; title: string; status: string };
type RecruiterApplication = { id: string; candidate_label: string; status: string; fit_score: number | null };
type RecruiterApplicationWithJob = RecruiterApplication & { job_title: string };
type AdminMetrics = {
  users: number;
  published_jobs: number;
  applications: number;
  audit_events: number;
  live_connections: number;
  completed_assessments: number;
  completed_mock_interviews: number;
  model_version: string;
  evaluation_state: string;
};

const closedStages = new Set(["rejected", "hired", "withdrawn"]);

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function firstName() {
  return getSession()?.user.full_name.trim().split(/\s+/)[0] || "there";
}

function useLiveHome(role: UserRole) {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    const stopNotifications = subscribeToNotifications(refresh);
    const stopWorkflow = subscribeToWorkflow(refresh);
    return () => { stopNotifications(); stopWorkflow(); };
  }, []);
  return {
    revision,
    unread: getNotifications(role, isDemoMode()).filter(item => !item.read).length,
    interviews: getScheduledInterviews(),
  };
}

function MiniBars({ data }: { data: { label: string; value: number; display?: string }[] }) {
  const maximum = Math.max(1, ...data.map(item => item.value));
  if (!data.some(item => item.value > 0)) return <div className="review-home-chart-empty">This graph will update when activity is created.</div>;
  return <div className="review-home-bars" role="img" aria-label={data.map(item => `${item.label}: ${item.display ?? item.value}`).join(", ")}>
    {data.map((item, index) => <div key={`${item.label}-${index}`}><span title={item.label}>{item.label}</span><b><i style={{ width: `${Math.max(4, item.value / maximum * 100)}%` }} /></b><strong>{item.display ?? item.value}</strong></div>)}
  </div>;
}

function CandidateHome() {
  const live = useLiveHome("candidate");
  const [applications, setApplications] = useState<CandidateApplication[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      api<CandidateApplication[]>("/applications/me"),
      api<Recommendation[]>("/recommendations/me/jobs"),
      api<Evidence[]>("/candidates/me/evidence"),
    ]).then(([applicationResult, recommendationResult, evidenceResult]) => {
      if (!active) return;
      if (applicationResult.status === "fulfilled") setApplications(applicationResult.value);
      if (recommendationResult.status === "fulfilled") setRecommendations(recommendationResult.value);
      if (evidenceResult.status === "fulfilled") setEvidence(evidenceResult.value);
      if ([applicationResult, recommendationResult, evidenceResult].every(result => result.status === "rejected")) setError("Your home summary could not be loaded.");
      setLoading(false);
    });
    return () => { active = false; };
  }, [live.revision]);

  const activeApplications = applications.filter(item => !closedStages.has(item.status));
  const topMatch = recommendations[0];
  const nextInterview = live.interviews.find(item => Date.parse(item.scheduledAt) > Date.now() && ["requested", "confirmed"].includes(item.status));
  const stageData = useMemo(() => Object.entries(applications.reduce<Record<string, number>>((rows, item) => {
    rows[item.status] = (rows[item.status] ?? 0) + 1;
    return rows;
  }, {})).map(([label, value]) => ({ label: label.replaceAll("_", " "), value })), [applications]);
  const fitData = recommendations.slice(0, 5).map(item => ({ label: item.title, value: item.match.score, display: `${item.match.score}%` }));
  const currentApplication = activeApplications[0];
  const currentJob = marketplaceJobs.find(job => job.id === currentApplication?.job_id);

  return <section className="workspace review-home">
    <div className="review-home-hero candidate-review-home"><div><span><Sparkles size={15} /> JOB-SEEKER HOME</span><h2>{greeting()}, {firstName()}.</h2><p>This is your private daily starting point—not the public product page. It brings together live matches, applications, interviews, supporting proof, and the next useful improvement.</p><div className="review-home-actions"><Link className="primary link-button" to="/jobs">Find jobs <ArrowRight size={16} /></Link><Link to="/candidate">Open full dashboard</Link></div></div><aside><small>BEST CURRENT OPPORTUNITY</small><strong>{topMatch?.title ?? "Build your first match"}</strong><p>{topMatch?.company ?? "Add job-related evidence to activate recommendations."}</p><b>{topMatch ? `${topMatch.match.score}%` : "—"}</b><span>evidence fit</span></aside></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="review-home-metrics" aria-busy={loading}><article><Waypoints /><div><strong>{loading ? "—" : activeApplications.length}</strong><span>Active applications</span></div></article><article><Target /><div><strong>{loading ? "—" : recommendations.length}</strong><span>Ranked opportunities</span></div></article><article><FileCheck2 /><div><strong>{loading ? "—" : evidence.filter(item => item.verified).length}</strong><span>Verified evidence</span></div></article><article><Bell /><div><strong>{live.unread}</strong><span>Unread updates</span></div></article></div>
    <div className="review-home-grid"><article className="panel review-home-priorities"><div className="review-home-title"><div><span className="eyebrow">TODAY'S PRIORITIES</span><h3>What deserves attention next</h3></div><CheckCircle2 /></div><Link to="/candidate/interviews"><CalendarDays /><div><strong>{nextInterview ? `Interview · ${nextInterview.jobTitle}` : "No upcoming interview"}</strong><span>{nextInterview ? new Date(nextInterview.scheduledAt).toLocaleString() : "New proposals will appear here."}</span></div><ArrowRight /></Link><Link to="/candidate/applications"><ClipboardList /><div><strong>{currentJob ? `${currentJob.title} · ${currentApplication.status.replaceAll("_", " ")}` : "Start your application pipeline"}</strong><span>{currentJob?.company ?? "Review your strongest evidence-ranked jobs."}</span></div><ArrowRight /></Link><Link to="/candidate"><Target /><div><strong>{topMatch?.match.next_best_actions[0] ?? "Create your first skill roadmap"}</strong><span>{topMatch?.match.missing_requirements.length ?? 0} gap(s) in your leading match.</span></div><ArrowRight /></Link></article><article className="panel review-home-quick"><span className="eyebrow">QUICK ACTIONS</span><h3>Move your search forward</h3><div><Link to="/jobs"><Search />Find jobs</Link><Link to="/candidate/applications"><ClipboardList />Applications</Link><Link to="/candidate/messages"><MessageSquareText />Messages</Link><Link to="/candidate/interviews"><CalendarDays />Interviews</Link></div></article></div>
    <div className="review-home-analytics"><article className="panel"><span className="eyebrow">LIVE ANALYTICS</span><h3>Your application stages</h3><p>Changes when your demo workflow changes.</p><MiniBars data={stageData} /></article><article className="panel"><span className="eyebrow">LIVE ANALYTICS</span><h3>Top evidence-fit opportunities</h3><p>Recalculates when new evidence is added.</p><MiniBars data={fitData} /></article></div>
  </section>;
}

function RecruiterHome() {
  const live = useLiveHome("recruiter");
  const [jobs, setJobs] = useState<RecruiterJob[]>([]);
  const [applications, setApplications] = useState<RecruiterApplicationWithJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const jobRows = await api<RecruiterJob[]>("/jobs/mine");
        const applicationRows = await Promise.all(jobRows.map(job => api<RecruiterApplication[]>(`/applications/recruiter/jobs/${job.id}`).then(rows => rows.map(row => ({ ...row, job_title: job.title }))))) as RecruiterApplicationWithJob[][];
        if (active) { setJobs(jobRows); setApplications(applicationRows.flat()); }
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "Recruiter home could not be loaded."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [live.revision]);

  const reviewQueue = applications.filter(item => ["applied", "under_review"].includes(item.status));
  const nextInterview = live.interviews.find(item => Date.parse(item.scheduledAt) > Date.now() && ["requested", "confirmed"].includes(item.status));
  const jobData = jobs.map(job => ({ label: job.title, value: applications.filter(item => item.job_title === job.title).length }));
  const pipelineData = Object.entries(applications.reduce<Record<string, number>>((rows, item) => { rows[item.status] = (rows[item.status] ?? 0) + 1; return rows; }, {})).map(([label, value]) => ({ label: label.replaceAll("_", " "), value }));

  return <section className="workspace review-home">
    <div className="review-home-hero recruiter-review-home"><div><span><BriefcaseBusiness size={15} /> RECRUITER HOME</span><h2>{greeting()}, {firstName()}.</h2><p>Your private operating summary for openings, applicants, interviews, communications, and human-owned review priorities.</p><div className="review-home-actions"><Link className="primary link-button" to="/recruiter">Jobs and applicants <ArrowRight size={16} /></Link><Link to="/recruiter/assistant">Ask AI assistant</Link></div></div><aside><small>HUMAN REVIEW QUEUE</small><strong>{loading ? "Loading…" : `${reviewQueue.length} applicants`}</strong><p>Waiting for evidence review or a recorded human action.</p><b>{jobs.filter(job => job.status === "published").length}</b><span>published jobs</span></aside></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="review-home-metrics"><article><BriefcaseBusiness /><div><strong>{loading ? "—" : jobs.filter(job => job.status === "published").length}</strong><span>Published jobs</span></div></article><article><UsersRound /><div><strong>{loading ? "—" : applications.length}</strong><span>Total applicants</span></div></article><article><CalendarDays /><div><strong>{live.interviews.length}</strong><span>Interview records</span></div></article><article><Bell /><div><strong>{live.unread}</strong><span>Unread updates</span></div></article></div>
    <div className="review-home-grid"><article className="panel review-home-priorities"><div className="review-home-title"><div><span className="eyebrow">REVIEW PRIORITIES</span><h3>Human actions waiting for you</h3></div><UsersRound /></div><Link to="/recruiter"><UsersRound /><div><strong>{reviewQueue[0] ? `${reviewQueue[0].candidate_label} · ${reviewQueue[0].job_title}` : "No unreviewed applicants"}</strong><span>{reviewQueue[0] ? `Current stage: ${reviewQueue[0].status.replaceAll("_", " ")}` : "New applications will appear here."}</span></div><ArrowRight /></Link><Link to="/recruiter/interviews"><CalendarDays /><div><strong>{nextInterview ? `Next interview · ${nextInterview.jobTitle}` : "No upcoming interview"}</strong><span>{nextInterview ? `${nextInterview.candidateName} · ${new Date(nextInterview.scheduledAt).toLocaleString()}` : "Schedule from an applicant record."}</span></div><ArrowRight /></Link><Link to="/recruiter/assistant"><Bot /><div><strong>Prepare an evidence-grounded review</strong><span>The assistant advises but never changes an application stage.</span></div><ArrowRight /></Link></article><article className="panel review-home-quick"><span className="eyebrow">QUICK ACTIONS</span><h3>Run the hiring workflow</h3><div><Link to="/recruiter"><BriefcaseBusiness />Post a job</Link><Link to="/recruiter/assistant"><Bot />AI assistant</Link><Link to="/recruiter/messages"><MessageSquareText />Messages</Link><Link to="/recruiter/interviews"><CalendarDays />Scheduling</Link></div></article></div>
    <div className="review-home-analytics"><article className="panel"><span className="eyebrow">LIVE ANALYTICS</span><h3>Applicants by opening</h3><p>Derived from the current applicant records.</p><MiniBars data={jobData} /></article><article className="panel"><span className="eyebrow">LIVE ANALYTICS</span><h3>Your hiring pipeline</h3><p>Reflects human-confirmed application stages.</p><MiniBars data={pipelineData} /></article></div>
  </section>;
}

function AdminHome() {
  const live = useLiveHome("admin");
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; api<AdminMetrics>("/admin/metrics").then(rows => { if (active) setMetrics(rows); }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Platform home could not be loaded."); }); return () => { active = false; }; }, [live.revision]);
  const activity = metrics ? [{ label: "Jobs", value: metrics.published_jobs }, { label: "Applications", value: metrics.applications }, { label: "Assessments", value: metrics.completed_assessments }, { label: "Typed interviews", value: metrics.completed_mock_interviews }, { label: "Audit events", value: metrics.audit_events }] : [];
  return <section className="workspace review-home">
    <div className="review-home-hero admin-review-home"><div><span><ShieldCheck size={15} /> PLATFORM HOME</span><h2>{greeting()}, {firstName()}.</h2><p>Your private entry point for platform health, model governance, identity state, audit activity, and responsible-AI controls.</p><div className="review-home-actions"><Link className="primary link-button" to="/admin">Governance console <ArrowRight size={16} /></Link></div></div><aside><small>PLATFORM STATE</small><strong>{metrics?.evaluation_state.replaceAll("_", " ") ?? "Loading…"}</strong><p>{metrics?.model_version ?? "Loading model registry"}</p><b>{metrics?.live_connections ?? "—"}</b><span>live connections</span></aside></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="review-home-metrics"><article><UsersRound /><div><strong>{metrics?.users ?? "—"}</strong><span>Total users</span></div></article><article><Waypoints /><div><strong>{metrics?.applications ?? "—"}</strong><span>Applications</span></div></article><article><Activity /><div><strong>{metrics?.audit_events ?? "—"}</strong><span>Audit events</span></div></article><article><Bell /><div><strong>{live.unread}</strong><span>Unread alerts</span></div></article></div>
    <div className="review-home-grid"><article className="panel review-home-priorities"><div className="review-home-title"><div><span className="eyebrow">OPERATIONAL PRIORITIES</span><h3>Trust and quality checks</h3></div><ShieldCheck /></div><Link to="/admin"><ShieldCheck /><div><strong>Inspect model and policy state</strong><span>AI remains advisory; autonomous stage changes are disabled.</span></div><ArrowRight /></Link><Link to="/admin"><Activity /><div><strong>{metrics?.audit_events.toLocaleString() ?? "—"} recorded audit events</strong><span>Review traceability and operational signals.</span></div><ArrowRight /></Link><Link to="/admin"><CheckCircle2 /><div><strong>Verify identity and interview boundaries</strong><span>Role isolation and typed-answer-only evaluation remain active.</span></div><ArrowRight /></Link></article><article className="panel review-home-quick"><span className="eyebrow">QUICK ACTIONS</span><h3>Operate the platform</h3><div><Link to="/admin"><ShieldCheck />Governance</Link><Link to="/admin"><UsersRound />Identity health</Link><Link to="/admin"><Activity />Audit trail</Link><Link to="/admin"><CheckCircle2 />Policy state</Link></div></article></div>
    <div className="review-home-analytics single"><article className="panel"><span className="eyebrow">LIVE ANALYTICS</span><h3>Current platform activity</h3><p>Uses the current demo service state rather than a fixed chart image.</p><MiniBars data={activity} /></article></div>
  </section>;
}

export default function WorkspaceHomePage() {
  const role = getSession()?.user.role;
  if (role === "candidate") return <CandidateHome />;
  if (role === "recruiter") return <RecruiterHome />;
  if (role === "admin") return <AdminHome />;
  return <section className="workspace"><div className="empty-state"><ShieldCheck /><h3>Secure home unavailable</h3><p>Exit and select an account perspective again.</p></div></section>;
}
