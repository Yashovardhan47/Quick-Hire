import { ArrowRight, BriefcaseBusiness, CalendarDays, CheckCircle2, Circle, Clock3, MessageSquareText, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { marketplaceJobs } from "../data/marketplace";
import { api } from "../lib/api";

type Application = { id: string; job_id: string; status: string };

const stages = ["applied", "under_review", "assessment", "interview", "offer", "hired"];
const stageNames: Record<string, string> = {
  applied: "Applied",
  under_review: "Recruiter review",
  assessment: "Skill check",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Closed",
};

export default function ApplicationTracker() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setApplications(await api<Application[]>("/applications/me"));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load applications");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="workspace application-tracker-page">
      <div className="section-heading">
        <div><span className="eyebrow">MY APPLICATIONS</span><h2>Know what is happening with every job</h2></div>
        <Link className="primary link-button" to="/jobs"><Search size={17} /> Find more jobs</Link>
      </div>
      <div className="plain-language-note"><BriefcaseBusiness /><div><strong>One clear timeline for every application</strong><p>QuickHire shows recruiter-owned stage updates. AI suggestions never move an application automatically.</p></div></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {loading ? <div className="tracker-loading">Loading your applications…</div> : <div className="application-list">
        {applications.map(application => {
          const job = marketplaceJobs.find(item => item.id === application.job_id);
          const activeIndex = stages.indexOf(application.status);
          return <article className="application-card" key={application.id}>
            <div className="application-card-head"><span className="company-mark">{job?.companyMark ?? "QH"}</span><div><small>{job?.company ?? "QuickHire employer"}</small><h3>{job?.title ?? "Job application"}</h3><span className={`status ${application.status === "rejected" ? "warning" : ""}`}>{stageNames[application.status] ?? application.status.replaceAll("_", " ")}</span></div></div>
            {application.status === "rejected" ? <div className="closed-application"><Circle /><p>This application is closed. The recorded outcome belongs to the recruiter, not the AI recommendation.</p></div> : <div className="application-stage-track">{stages.slice(0, 5).map((stage, index) => <div className={index <= activeIndex ? "complete" : index === activeIndex + 1 ? "next" : ""} key={stage}>{index <= activeIndex ? <CheckCircle2 /> : <Circle />}<span>{stageNames[stage]}</span></div>)}</div>}
            <div className="application-next-step"><Clock3 /><p><strong>{application.status === "assessment" ? "Complete the requested skill check" : application.status === "under_review" ? "Recruiter review is in progress" : "Keep your profile and supporting proof current"}</strong><span>{application.status === "assessment" ? "Objective answers can add verified skill proof; written responses go to human review." : "You will receive an in-app notification when the recruiter records a change."}</span></p></div>
            <div className="button-row">
              <Link className="secondary link-button" to="/candidate/messages"><MessageSquareText size={16} /> Message recruiter</Link>
              <Link className="secondary link-button" to="/candidate/interviews"><CalendarDays size={16} /> Interviews</Link>
              {job && <Link className="text-link" to={`/jobs?selected=${job.id}`}>Open job <ArrowRight size={15} /></Link>}
            </div>
          </article>;
        })}
        {applications.length === 0 && <div className="empty-state"><BriefcaseBusiness /><h3>No applications yet</h3><p>Find a suitable job, review why you match, and apply when you are ready.</p><Link className="primary link-button" to="/jobs">Explore jobs</Link></div>}
      </div>}
    </section>
  );
}
