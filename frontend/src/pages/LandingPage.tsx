import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, Bot, BriefcaseBusiness, CheckCircle2, CirclePlay, FileCheck2, MapPin, Network, Search, ShieldCheck, Sparkles, Target, UserRoundSearch } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api, getSession } from "../lib/api";

type Job = { id: string; title: string; company: string; description: string; location: string; employment_type: string; requirements: { name: string; mandatory: boolean }[] };

export default function LandingPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const session = getSession();

  useEffect(() => {
    api<Job[]>("/jobs").then(setJobs).catch(reason => setError(reason instanceof Error ? reason.message : "Job marketplace unavailable")).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const elements = [...document.querySelectorAll<HTMLElement>(".landing-reveal")];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { elements.forEach(item => item.classList.add("visible")); return; }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add("visible"); observer.unobserve(entry.target); }
    }), { threshold: .12 });
    elements.forEach(item => observer.observe(item));
    return () => observer.disconnect();
  }, [jobs.length]);

  const filteredJobs = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return jobs;
    return jobs.filter(job => [job.title, job.company, job.location, job.description, ...job.requirements.map(item => item.name)].join(" ").toLowerCase().includes(value));
  }, [jobs, query]);

  function search(event: FormEvent) {
    event.preventDefault();
    document.getElementById("live-jobs")?.scrollIntoView({ behavior: "smooth" });
  }

  const workspace = session ? `/${session.user.role}` : "/login";
  return <div className="landing-page">
    <nav className="landing-nav"><Link className="landing-brand" to="/"><Network /> <span>QuickHire</span><small>EvidenceGraph</small></Link><div><a href="#live-jobs">Jobs</a><a href="#how-it-works">How it works</a><a href="#overview">Overview</a><a href="#workspaces">Workspaces</a></div><Link className="landing-login" to={workspace}>{session ? "Open workspace" : "Sign in"} <ArrowRight size={16} /></Link></nav>

    <main>
      <section className="landing-hero">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-glow hero-glow-a" aria-hidden="true" /><div className="hero-glow hero-glow-b" aria-hidden="true" />
        <div className="landing-hero-copy landing-reveal visible"><span className="landing-kicker"><Sparkles size={15} /> AI JOB SEARCH + RECRUITER ASSISTANCE</span><h1>Find the right job.<br /><em>See what proves the match.</em></h1><p>QuickHire combines job discovery, applications, skill roadmaps, messages, interviews, recruiter workflows, and responsible AI in one focused hiring network.</p><form className="landing-search" onSubmit={search}><Search /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search real jobs by role, skill, company or location" aria-label="Search jobs" /><button>Search jobs <ArrowRight size={17} /></button></form><div className="landing-proof"><span><CheckCircle2 /> Real database workflows</span><span><ShieldCheck /> Human hiring decisions</span><span><Bot /> Typed-content AI only</span></div></div>
        <div className="evidence-demo landing-reveal visible"><div className="evidence-demo-head"><span>Why this role fits</span><b>Live evidence view</b></div><div className="evidence-role"><div className="company-orb">QH</div><div><strong>Role requirement</strong><p>Python API engineering</p></div><span>Required</span></div><div className="evidence-path"><div><FileCheck2 /><span><b>Supporting proof</b><small>Resume project + verified check</small></span><strong>Strong</strong></div><div><Network /><span><b>EvidenceGraph link</b><small>Requirement connected to sources</small></span><strong>Clear</strong></div><div className="gap"><Target /><span><b>Missing next</b><small>Deployment monitoring evidence</small></span><strong>Roadmap</strong></div></div><p className="human-line"><ShieldCheck size={17} /> AI explains the proof. A recruiter makes the decision.</p></div>
      </section>

      <section className="landing-section" id="live-jobs"><div className="landing-heading landing-reveal"><div><span className="landing-kicker">LIVE JOB MARKETPLACE</span><h2>Every published opportunity, directly from recruiters.</h2></div><strong>{loading ? "Loading…" : `${filteredJobs.length} job${filteredJobs.length === 1 ? "" : "s"}`}</strong></div>{error && <div className="form-error">{error}</div>}<div className="landing-job-grid">{filteredJobs.map((job, index) => <article className="landing-job-card landing-reveal" style={{ transitionDelay: `${Math.min(index, 5) * 45}ms` }} key={job.id}><div><span className="company-orb">{job.company.slice(0, 2).toUpperCase()}</span><span className="verified-company"><ShieldCheck size={13} /> Published</span></div><h3>{job.title}</h3><p className="job-company">{job.company}</p><div className="job-meta"><span><MapPin size={14} /> {job.location || "Flexible"}</span><span>{job.employment_type}</span></div><div className="job-requirements">{job.requirements.slice(0, 4).map(item => <span key={item.name}>{item.name}</span>)}</div><Link to={session?.user.role === "candidate" ? "/candidate" : "/login"}>View and apply <ArrowRight size={16} /></Link></article>)}{!loading && filteredJobs.length === 0 && <div className="empty-state landing-empty"><BriefcaseBusiness /><h3>No matching published jobs</h3><p>Change the search, or sign in as a recruiter to publish the first real opportunity.</p></div>}</div></section>

      <section className="landing-section explainer-section" id="how-it-works"><div className="landing-heading landing-reveal"><div><span className="landing-kicker">EVIDENCEGRAPH, IN PLAIN LANGUAGE</span><h2>A clear map between what a job needs and what a candidate can prove.</h2></div></div><div className="explanation-flow landing-reveal"><article><span>01</span><BriefcaseBusiness /><h3>Job requirement</h3><p>A recruiter publishes measurable skills and outcomes, not personal traits.</p></article><ArrowRight /><article><span>02</span><FileCheck2 /><h3>Supporting proof</h3><p>Resume projects, assessments, portfolios, and typed interview answers support each skill.</p></article><ArrowRight /><article><span>03</span><Target /><h3>Gap and roadmap</h3><p>Missing proof becomes a practical improvement step—not an automatic rejection.</p></article></div></section>

      <section className="landing-section overview-section-production" id="overview"><div className="overview-production-copy landing-reveal"><span className="landing-kicker"><CirclePlay size={15} /> NARRATED PRODUCT OVERVIEW</span><h2>Hear the complete QuickHire idea in 24 seconds.</h2><p>The video explains job discovery, evidence-backed suggestions, candidate improvement, recruiter review, and the human decision boundary. Captions are included.</p><ul><li>Current job discovery and applications</li><li>Personal skill-gap roadmap</li><li>Recruiter pipeline and assistance</li><li>Responsible, reviewable AI</li></ul></div><div className="production-video-shell landing-reveal"><div className="video-top"><span /><span /><span /><b>QuickHire overview · 00:24</b></div><video controls playsInline preload="metadata" poster="/quickhire-overview-poster.jpg"><source src="/quickhire-overview.mp4" type="video/mp4" /><track kind="captions" src="/quickhire-overview.vtt" srcLang="en" label="English" default />Your browser does not support video.</video></div></section>

      <section className="landing-section workspace-section" id="workspaces"><div className="landing-heading landing-reveal"><div><span className="landing-kicker">CONNECTED WORKSPACES</span><h2>One platform, three focused dashboards.</h2></div></div><div className="workspace-cards"><article className="landing-reveal"><UserRoundSearch /><span>JOB SEEKER</span><h3>Discover, apply, improve</h3><p>Recommendations, applications, assessments, messages, interview times, and a requirement-by-requirement roadmap.</p><Link to="/login">Candidate workspace <ArrowRight size={16} /></Link></article><article className="landing-reveal"><BriefcaseBusiness /><span>RECRUITER</span><h3>Publish, review, communicate</h3><p>Every real applicant, job-specific proof, AI-assisted preparation, scheduling, messages, and human-owned pipeline decisions.</p><Link to="/login">Recruiter workspace <ArrowRight size={16} /></Link></article><article className="landing-reveal"><ShieldCheck /><span>PLATFORM ADMIN</span><h3>Operate trust and quality</h3><p>Policy enforcement, delivery health, model state, audits, and restricted candidate recourse workflows.</p><Link to="/login">Admin sign in <ArrowRight size={16} /></Link></article></div></section>

      <section className="landing-cta landing-reveal"><div><span className="landing-kicker">READY TO USE THE COMPLETE WORKFLOW?</span><h2>Start with an account. Keep every employment decision human.</h2></div><button onClick={() => navigate(workspace)}>{session ? "Open your workspace" : "Create or sign in"} <ArrowRight /></button></section>
    </main>
    <footer className="landing-footer"><span>QuickHire EvidenceGraph</span><p>AI-assisted job search and recruiting · No biometric or protected-trait scoring.</p></footer>
  </div>;
}
