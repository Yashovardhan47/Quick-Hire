import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  BriefcaseBusiness,
  Check,
  Clock3,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  UsersRound,
  X,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PublicFooter from "../components/PublicFooter";
import PublicNav from "../components/PublicNav";
import { marketplaceCategories, marketplaceJobs, MarketplaceJob } from "../data/marketplace";
import { startDemoSession } from "../lib/api";
import { fetchLiveJobs } from "../lib/liveJobs";
import { pushNotification } from "../lib/liveState";

const modes = ["All", "Remote", "Hybrid", "On-site"];
const types = ["All", "Full-time", "Internship", "Contract"];

export default function JobMarketplace() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState(params.get("category") ?? "All");
  const [mode, setMode] = useState("All");
  const [type, setType] = useState("All");
  const [sort, setSort] = useState("recommended");
  const [savedOnly, setSavedOnly] = useState(false);
  const [sourceMode, setSourceMode] = useState<"quickhire" | "live">("quickhire");
  const [liveJobs, setLiveJobs] = useState<MarketplaceJob[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [saved, setSaved] = useState<string[]>(() => {
    try { return JSON.parse(sessionStorage.getItem("quickhire.review.saved-jobs") ?? "[]") as string[]; } catch { return []; }
  });
  const initialSelected = params.get("selected");
  const [selectedId, setSelectedId] = useState(initialSelected ?? marketplaceJobs[0].id);
  const jobs = sourceMode === "live" ? liveJobs : marketplaceJobs;
  const categories = useMemo(() => sourceMode === "live" ? ["All", ...Array.from(new Set(liveJobs.map(job => job.category)))] : marketplaceCategories, [liveJobs, sourceMode]);

  useEffect(() => { sessionStorage.setItem("quickhire.review.saved-jobs", JSON.stringify(saved)); }, [saved]);

  useEffect(() => {
    if (sourceMode !== "live" || liveJobs.length > 0 || liveLoading || liveError) return;
    setLiveLoading(true);
    setLiveError("");
    fetchLiveJobs()
      .then(rows => { setLiveJobs(rows); setSelectedId(rows[0]?.id ?? ""); })
      .catch(reason => setLiveError(reason instanceof Error ? reason.message : "Unable to load live jobs"))
      .finally(() => setLiveLoading(false));
  }, [liveError, liveJobs.length, liveLoading, sourceMode]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const rows = jobs.filter(job => {
      const searchable = [job.title, job.company, job.location, job.category, ...job.skills].join(" ").toLowerCase();
      return (!normalized || searchable.includes(normalized))
        && (!savedOnly || saved.includes(job.id))
        && (category === "All" || job.category === category)
        && (mode === "All" || job.workMode === mode)
        && (type === "All" || job.type === type);
    });
    return [...rows].sort((a, b) => sort === "most_applicants" ? b.applicants - a.applicants : b.fit - a.fit);
  }, [category, jobs, mode, query, saved, savedOnly, sort, type]);

  const selected = jobs.find(job => job.id === selectedId) ?? filtered[0] ?? null;

  function chooseJob(job: MarketplaceJob) {
    setSelectedId(job.id);
    const next = new URLSearchParams(params);
    next.set("selected", job.id);
    setParams(next, { replace: true });
  }

  function openCandidate(job: MarketplaceJob) {
    startDemoSession("candidate");
    navigate(`/candidate?target=${job.id}`);
  }

  function clearFilters() {
    setQuery(""); setCategory("All"); setMode("All"); setType("All"); setSavedOnly(false);
    setParams({}, { replace: true });
  }

  function changeSource(next: "quickhire" | "live") {
    setSourceMode(next);
    setCategory("All"); setMode("All"); setType("All"); setQuery(""); setSavedOnly(false);
    setSelectedId(next === "quickhire" ? marketplaceJobs[0].id : liveJobs[0]?.id ?? "");
  }

  function toggleSaved(job: MarketplaceJob) {
    const isSaved = saved.includes(job.id);
    setSaved(current => isSaved ? current.filter(id => id !== job.id) : [...current, job.id]);
    if (!isSaved) pushNotification({ role: "candidate", type: "job.saved", title: "Job saved", message: `${job.title} at ${job.company} was added to your saved jobs.` });
  }

  return (
    <div className="public-site marketplace-site">
      <PublicNav />
      <main className="marketplace-main">
        <section className="marketplace-hero">
          <div><span className="public-kicker"><BriefcaseBusiness size={15} /> JOB SEARCH</span><h1>Find jobs. Understand your match. Apply with confidence.</h1><p>Search QuickHire opportunities with match explanations, or browse current external listings that open directly on the source job board.</p></div>
          <div className="marketplace-pulse"><strong>{jobs.length || "—"}</strong><span>{sourceMode === "live" ? "live external listings" : "QuickHire opportunities"}</span><b>{Math.max(categories.length - 1, 0)} career fields</b></div>
        </section>

        <div className="job-source-switch" role="tablist" aria-label="Job data source"><button type="button" role="tab" aria-selected={sourceMode === "quickhire"} className={sourceMode === "quickhire" ? "active" : ""} onClick={() => changeSource("quickhire")}><Sparkles /> QuickHire jobs <small>Match explanation + in-app application</small></button><button type="button" role="tab" aria-selected={sourceMode === "live"} className={sourceMode === "live" ? "active" : ""} onClick={() => changeSource("live")}><BriefcaseBusiness /> Live external jobs <small>Current listings from Arbeitnow</small></button></div>
        {liveLoading && <div className="live-source-status">Loading current job listings…</div>}
        {sourceMode === "live" && liveError && <div className="form-error" role="alert">{liveError} <button type="button" className="text-button" onClick={() => { setLiveError(""); setLiveJobs([]); }}>Retry</button></div>}

        <section className="marketplace-search-panel" aria-label="Job filters">
          <label className="market-search"><Search size={20} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search title, skill, company or location" aria-label="Search all jobs" />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={17} /></button>}</label>
          <label><span>Career field</span><select value={category} onChange={event => setCategory(event.target.value)}>{categories.map(item => <option key={item}>{item}</option>)}</select></label>
          <label><span>Work mode</span><select value={mode} onChange={event => setMode(event.target.value)}>{modes.map(item => <option key={item}>{item}</option>)}</select></label>
          <label><span>Job type</span><select value={type} onChange={event => setType(event.target.value)}>{types.map(item => <option key={item}>{item}</option>)}</select></label>
        </section>

        <div className="marketplace-toolbar">
          <div><SlidersHorizontal size={17} /><strong>{filtered.length}</strong> of {jobs.length} jobs</div>
          <div className="marketplace-toolbar-actions">
            <button type="button" className={savedOnly ? "saved-filter active" : "saved-filter"} onClick={() => setSavedOnly(current => !current)}><Bookmark size={16} fill={savedOnly ? "currentColor" : "none"} /> Saved ({jobs.filter(job => saved.includes(job.id)).length})</button>
            {sourceMode === "quickhire" && <label>Sort by<select value={sort} onChange={event => setSort(event.target.value)}><option value="recommended">Best match</option><option value="most_applicants">Most applicants</option></select></label>}
          </div>
        </div>

        <section className="job-browser">
          <div className="job-results" aria-label="Job search results">
            {filtered.map(job => (
              <article className={`job-result-card ${selected?.id === job.id ? "selected" : ""}`} key={job.id}>
                <button className="job-result-main" type="button" onClick={() => chooseJob(job)}>
                  <span className="company-mark large">{job.companyMark}</span>
                  <span className="job-result-copy"><small>{job.category} · {job.posted}</small><strong>{job.title}</strong><span>{job.company}</span><span className="result-location"><MapPin size={14} /> {job.location} · {job.workMode} · {job.type}</span><span className="result-skills">{job.skills.slice(0, 4).map(skill => <b key={skill}>{skill}</b>)}</span></span>
                  <span className="result-fit">{job.live ? <><strong>Live</strong><small>external listing</small><b>{job.source}</b></> : <><strong>{job.fit}%</strong><small>requirements match</small><b>{job.confidence}% reliability</b></>}</span>
                </button>
                <button type="button" className={saved.includes(job.id) ? "save-job saved" : "save-job"} aria-label={saved.includes(job.id) ? `Unsave ${job.title}` : `Save ${job.title}`} onClick={() => toggleSaved(job)}><Bookmark size={18} fill={saved.includes(job.id) ? "currentColor" : "none"} /></button>
              </article>
            ))}
            {filtered.length === 0 && <div className="market-empty"><Target /><h2>No exact matches</h2><p>Try a broader skill, location, work mode, or career field.</p><button type="button" onClick={clearFilters}>Clear filters</button></div>}
          </div>

          {selected && <aside className="job-detail-panel">
            <div className="job-detail-heading"><span className="company-mark xl">{selected.companyMark}</span><div><span className="job-category">{selected.category}</span><h2>{selected.title}</h2><p>{selected.company} · {selected.location}</p></div><span className="verified-company"><ShieldCheck size={14} /> {selected.live ? `${selected.source} source` : "Verified employer"}</span></div>
            <div className="detail-meta"><span><BriefcaseBusiness /> {selected.type}</span><span><MapPin /> {selected.workMode}</span><span><Clock3 /> {selected.posted}</span>{!selected.live && <span><UsersRound /> {selected.applicants} applicants</span>}</div>
            <p className="job-summary">{selected.summary}</p>
            <div className="salary-row"><span>Estimated compensation</span><strong>{selected.salary}</strong></div>
            <div className="detail-section"><h3>{selected.live ? "Listing categories" : "Why this job may match"}</h3>{selected.skills.map((skill, index) => {
              const coverage = Math.max(36, selected.fit - index * 11 + (index === 0 ? 7 : 0));
              return selected.live ? <span className="chip good" key={skill}>{skill}</span> : <div className="requirement-row" key={skill}><span>{skill}</span><div><b style={{ width: `${coverage}%` }} /></div><strong>{coverage}%</strong></div>;
            })}</div>
            {selected.live ? <div className="detail-suggestion"><BriefcaseBusiness /><div><strong>Current external listing</strong><p>Review the complete requirements and submit the application on the source job board. QuickHire does not copy or alter the employer’s application.</p></div></div> : <><div className="detail-suggestion"><Sparkles /><div><strong>Best next move</strong><p>{selected.fit >= 80 ? `Apply with your current supporting proof, then verify ${selected.skills.at(-1)} to improve reliability.` : `Build one verified ${selected.skills[1]} signal before treating this as a strong recommendation.`}</p></div></div><div className="detail-policy"><Check /> This suggestion is advisory. A recruiter reviews the complete application.</div></>}
            {selected.live && selected.externalUrl ? <a className="detail-cta" href={selected.externalUrl} target="_blank" rel="noreferrer">Open source listing <ArrowRight size={18} /></a> : <button className="detail-cta" type="button" onClick={() => openCandidate(selected)}>See why you match <ArrowRight size={18} /></button>}
            <button className="detail-secondary" type="button" onClick={() => toggleSaved(selected)}>{saved.includes(selected.id) ? "Saved" : "Save for later"}</button>
          </aside>}
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
