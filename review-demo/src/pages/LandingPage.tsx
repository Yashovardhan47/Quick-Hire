import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CirclePlay,
  FileSearch,
  Fingerprint,
  Gauge,
  MapPin,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  UserRoundSearch,
  UsersRound,
  Waypoints,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import PublicFooter from "../components/PublicFooter";
import PublicNav from "../components/PublicNav";
import { marketplaceCategories, marketplaceJobs } from "../data/marketplace";
import { UserRole } from "../lib/api";

const roleContent = {
  candidate: {
    eyebrow: "JOB SEEKER WORKSPACE",
    title: "Find jobs, understand your match, and improve what is missing.",
    body: "Track applications, see the supporting proof behind every suggestion, and follow a simple skill-by-skill improvement plan.",
    bullets: ["Job suggestions with clear reasons", "Skill-gap plan and targeted checks", "Applications, interviews and recruiter messages"],
    metric: "88%",
    metricLabel: "top verified fit",
  },
  recruiter: {
    eyebrow: "RECRUITER WORKSPACE",
    title: "Review every applicant with the same job-related evidence lens.",
    body: "See the complete pipeline, compare job-related proof, use the AI assistant, and record every human-owned stage decision with a reason.",
    bullets: ["All applicants in one live pipeline", "AI-assisted review and interview planning", "Scheduling, messages and hiring analytics"],
    metric: "12/12",
    metricLabel: "applicants visible",
  },
  admin: {
    eyebrow: "PLATFORM ADMIN WORKSPACE",
    title: "Operate AI quality, access, and policy from one control plane.",
    body: "Monitor authentication, AI quality, audit events, and the safeguards that keep every employment decision human-owned.",
    bullets: ["JWT and Google identity health", "Model and governance registry", "Policy enforcement and audit monitoring"],
    metric: "18.4k",
    metricLabel: "audited events",
  },
};

export default function LandingPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState("");
  const [activeRole, setActiveRole] = useState<UserRole>("candidate");
  const [activeJob, setActiveJob] = useState(0);
  const featured = useMemo(() => marketplaceJobs.slice(0, 6), []);

  useEffect(() => {
    const section = params.get("section");
    if (section) window.setTimeout(() => document.getElementById(section)?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [params]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActiveJob(current => (current + 1) % 3), 3200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach(node => node.classList.add("revealed"));
      return;
    }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
        observer.unobserve(entry.target);
      }
    }), { threshold: 0.12 });
    nodes.forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  function findJobs(event: FormEvent) {
    event.preventDefault();
    navigate(`/jobs${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
  }

  function openWorkspace(role: UserRole) {
    navigate(`/login?mode=register&role=${role}`);
  }

  const selectedRole = roleContent[activeRole];
  const heroJobs = marketplaceJobs.slice(0, 3);

  return (
    <div className="public-site">
      <PublicNav onSection={id => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })} />

      <main className="landing-main">
        <section className="public-hero">
          <div className="hero-orbit hero-orbit-one" aria-hidden="true" />
          <div className="hero-orbit hero-orbit-two" aria-hidden="true" />
          <div className="hero-copy reveal revealed">
            <span className="public-kicker"><Sparkles size={15} /> AI JOB SEARCH + RECRUITER ASSISTANCE</span>
            <h1>Find jobs.<br /><em>Know why you match.</em></h1>
            <p>QuickHire combines current job discovery, applications, skill improvement, recruiter communication, interviews, and responsible AI assistance—without a distracting content feed.</p>
            <form className="hero-search" onSubmit={findJobs}>
              <Search size={21} />
              <input value={query} onChange={event => setQuery(event.target.value)} aria-label="Search jobs" placeholder="Job title, skill, company or location" />
              <button type="submit">Explore jobs <ArrowRight size={18} /></button>
            </form>
            <div className="hero-proof-row">
              <span><strong>18</strong> live demo roles</span>
              <span><strong>3</strong> role workspaces</span>
              <span><strong>0</strong> biometric signals</span>
            </div>
          </div>

          <div className="hero-intelligence reveal revealed" aria-label="Example job match explanation">
            <div className="hero-panel-top">
              <span className="mini-brand"><Network size={17} /> Why you match</span>
              <span className="live-pill">Updated from your profile</span>
            </div>
            <div className="hero-candidate-row">
              <div className="avatar-mark">AM</div>
              <div><strong>Aarav’s next best role</strong><span>{heroJobs[activeJob].company} · {heroJobs[activeJob].location}</span></div>
              <div className="hero-score"><b>{heroJobs[activeJob].fit}</b><small>% fit</small></div>
            </div>
            <div className="hero-role-switcher" aria-live="polite">
              <span>{heroJobs[activeJob].title}</span>
              <small>{heroJobs[activeJob].confidence}% confidence · human review required</small>
            </div>
            <div className="evidence-thread">
              <div><span className="thread-icon"><FileSearch size={16} /></span><p><b>Your supporting proof</b><small>Python, APIs, ML evaluation</small></p><strong>92</strong></div>
              <div><span className="thread-icon"><Target size={16} /></span><p><b>Verified skills</b><small>SQL and ML foundations</small></p><strong>89</strong></div>
              <div className="thread-gap"><span className="thread-icon"><Waypoints size={16} /></span><p><b>Improve next</b><small>MLOps and monitoring</small></p><strong>Plan</strong></div>
            </div>
            <button type="button" className="hero-panel-action" onClick={() => openWorkspace("candidate")}>See this job match <ChevronRight size={17} /></button>
          </div>
        </section>

        <section className="category-ribbon" aria-label="Job categories">
          <span>Explore every path</span>
          <div>{marketplaceCategories.slice(1).map(category => <Link key={category} to={`/jobs?category=${encodeURIComponent(category)}`}>{category}</Link>)}</div>
        </section>

        <section className="public-section jobs-section" id="jobs">
          <div className="public-section-heading reveal">
            <div><span className="public-kicker">JOB DISCOVERY</span><h2>One focused marketplace for every career move.</h2></div>
            <Link className="section-link" to="/jobs">View all {marketplaceJobs.length} jobs <ArrowRight size={18} /></Link>
          </div>
          <div className="featured-job-grid">
            {featured.map((job, index) => (
              <Link className="market-job-card reveal" style={{ transitionDelay: `${Math.min(index, 2) * 70}ms` }} to={`/jobs?selected=${job.id}`} key={job.id}>
                <div className="job-card-top"><span className="company-mark">{job.companyMark}</span><span className="verified-company"><ShieldCheck size={14} /> Verified</span></div>
                <div><span className="job-category">{job.category}</span><h3>{job.title}</h3><p className="job-company">{job.company}</p></div>
                <div className="job-meta"><span><MapPin size={15} /> {job.location}</span><span>{job.workMode}</span><span>{job.type}</span></div>
                <div className="job-skills">{job.skills.slice(0, 3).map(skill => <span key={skill}>{skill}</span>)}</div>
                <div className="job-card-bottom"><div><b>{job.fit}%</b><small>sample evidence fit</small></div><span>{job.applicants} applicants</span></div>
              </Link>
            ))}
          </div>
        </section>

        <section className="public-section ideology-section">
          <div className="ideology-lead reveal">
            <span className="public-kicker">OUR IDEOLOGY</span>
            <h2>A professional network for opportunities—not attention.</h2>
            <p>QuickHire keeps the useful parts of a professional network—companies, candidates, job discovery, messages, and trusted identity—but removes the content feed. Every screen helps someone find work or run a clearer hiring process.</p>
          </div>
          <div className="ideology-grid">
            <article className="reveal"><span>01</span><UserRoundSearch /><h3>Opportunity first</h3><p>Search, save, compare, apply, schedule, and track from one job-only workspace.</p></article>
            <article className="reveal"><span>02</span><Network /><h3>Reasons, not mystery scores</h3><p>Every suggestion explains which resume, project, assessment, or typed-interview proof supports it.</p></article>
            <article className="reveal"><span>03</span><ShieldCheck /><h3>People stay responsible</h3><p>AI explains and suggests. Recruiters confirm every consequential stage change with a reason.</p></article>
          </div>
        </section>

        <section className="public-section overview-section" id="overview">
          <div className="overview-copy reveal">
            <span className="public-kicker"><CirclePlay size={15} /> 24-SECOND NARRATED OVERVIEW</span>
            <h2>See and hear the complete hiring loop in 24 seconds.</h2>
            <p>Press play with sound to hear how job discovery, skill improvement, recruiter review, live updates, and responsible AI work together.</p>
            <ol className="video-chapters">
              <li><span>00:00</span> Discover focused job opportunities</li>
              <li><span>00:04</span> Explain candidate–job fit</li>
              <li><span>00:08</span> Connect match reasons to supporting proof</li>
              <li><span>00:12</span> Build a practical skill-improvement plan</li>
              <li><span>00:16</span> Review every applicant with human decisions</li>
              <li><span>00:20</span> Monitor safe AI governance</li>
            </ol>
          </div>
          <div className="overview-video-shell reveal">
            <div className="video-window-bar"><span /><span /><span /><b>QuickHire product tour · 00:24</b></div>
            <video controls playsInline preload="metadata" poster="/quickhire-overview-poster.jpg" aria-label="24-second narrated QuickHire product overview">
              <source src="/quickhire-overview.mp4" type="video/mp4" />
              <track kind="captions" src="/quickhire-overview.vtt" srcLang="en" label="English" default />
              Your browser does not support embedded video.
            </video>
          </div>
        </section>

        <section className="public-section workspaces-section">
          <div className="public-section-heading reveal"><div><span className="public-kicker">THREE CONNECTED WORKSPACES</span><h2>Different decisions. One trusted evidence layer.</h2></div></div>
          <div className="role-tabs reveal" role="tablist" aria-label="Role workspace previews">
            {(["candidate", "recruiter", "admin"] as UserRole[]).map(role => (
              <button key={role} type="button" role="tab" aria-selected={activeRole === role} className={activeRole === role ? "active" : ""} onClick={() => setActiveRole(role)}>
                {role === "candidate" ? <UserRoundSearch /> : role === "recruiter" ? <BriefcaseBusiness /> : <Gauge />}
                {role === "candidate" ? "Job seeker" : role === "recruiter" ? "Recruiter" : "Platform admin"}
              </button>
            ))}
          </div>
          <div className="role-showcase reveal">
            <div className="role-copy">
              <span className="public-kicker">{selectedRole.eyebrow}</span><h3>{selectedRole.title}</h3><p>{selectedRole.body}</p>
              <ul>{selectedRole.bullets.map(item => <li key={item}><Check size={16} /> {item}</li>)}</ul>
              <button type="button" onClick={() => openWorkspace(activeRole)}>Explore this workspace <ArrowRight size={18} /></button>
            </div>
            <div className={`role-preview role-${activeRole}`}>
              <div className="role-preview-head"><span>Workspace pulse</span><small>Sample data</small></div>
              <div className="role-preview-metric"><strong>{selectedRole.metric}</strong><span>{selectedRole.metricLabel}</span></div>
              {activeRole === "candidate" && <div className="preview-lines"><div><span>Python & APIs</span><b style={{ width: "92%" }} /></div><div><span>Machine learning</span><b style={{ width: "86%" }} /></div><div><span>MLOps</span><b className="gap" style={{ width: "42%" }} /></div></div>}
              {activeRole === "recruiter" && <div className="mini-pipeline"><div><span>New</span><b>4</b></div><div><span>Verify</span><b>5</b></div><div><span>Decision</span><b>3</b></div></div>}
              {activeRole === "admin" && <div className="admin-pulse"><div><Fingerprint /><span>704 Google identities</span></div><div><BarChart3 /><span>31 quality checks passing</span></div><div><ShieldCheck /><span>Advisory-only policy active</span></div></div>}
            </div>
          </div>
        </section>

        <section className="public-section roadmap-section">
          <div className="roadmap-head reveal"><span className="public-kicker">SKILL IMPROVEMENT PLAN</span><h2>Take the smallest useful step that strengthens a match.</h2><p>QuickHire turns missing job requirements into a practical plan instead of leaving candidates with a mysterious score.</p></div>
          <div className="roadmap-board reveal">
            <div className="roadmap-job"><span className="company-mark">AL</span><div><small>TARGET ROLE</small><strong>Applied AI Engineer</strong><span>Aster Labs · Bengaluru</span></div><b>88% fit</b></div>
            <div className="roadmap-track">
              <article className="complete"><span><Check /></span><div><small>FOUNDATION · VERIFIED</small><h3>Python + API engineering</h3><p>Resume, project, and assessment evidence agree.</p></div></article>
              <article className="active"><span>2</span><div><small>NEXT · 12 MINUTES</small><h3>MLOps targeted check</h3><p>Verify deployment monitoring and drift concepts.</p></div><b>+4–6 fit points</b></article>
              <article><span>3</span><div><small>THIS WEEK</small><h3>Add one deployment artifact</h3><p>Link a model card, monitoring dashboard, or tested pipeline.</p></div></article>
              <article><span>4</span><div><small>PRACTICE</small><h3>Typed system-design interview</h3><p>Explain rollback, auditability, and failure isolation.</p></div></article>
            </div>
          </div>
        </section>

        <section className="public-section trust-section">
          <div className="trust-copy reveal"><span className="public-kicker">RESPONSIBLE AI</span><h2>AI assistance with a clear decision boundary.</h2><p>QuickHire may search, organize, compare, and summarize job-related supporting proof. It never autonomously rejects, shortlists, offers, or hires.</p><button type="button" onClick={() => openWorkspace("admin")}>Open AI safety controls <ArrowRight size={18} /></button></div>
          <div className="trust-controls reveal">
            <div><ShieldCheck /><span><strong>Human confirmation</strong><small>Required for every stage transition</small></span></div>
            <div><Bot /><span><strong>Typed content only</strong><small>No face, voice, accent, emotion, or personality scoring</small></span></div>
            <div><Fingerprint /><span><strong>Protected signals blocked</strong><small>Excluded at ingestion, ranking, testing, and interview review</small></span></div>
            <div><BarChart3 /><span><strong>Reviewable explanations</strong><small>Supporting sources, reliability, and audit events</small></span></div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
