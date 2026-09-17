import { FormEvent, useCallback, useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api, getSession } from "../lib/api";

type Schedule = {
  id: string;
  application_id: string;
  job_title: string;
  candidate_name: string;
  starts_at: string;
  duration_minutes: number;
  timezone: string;
  meeting_url: string | null;
  status: string;
  candidate_note: string;
};

export default function InterviewSchedulePage() {
  const role = getSession()?.user.role;
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<Schedule[]>([]);
  const [applicationId, setApplicationId] = useState(searchParams.get("application") ?? "");
  const [startsAt, setStartsAt] = useState("");
  const [duration, setDuration] = useState(45);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const load = useCallback(async () => {
    try { setRows(await api<Schedule[]>("/interview-schedules")); }
    catch (reason) { setStatus(reason instanceof Error ? reason.message : "Unable to load interviews"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function propose(event: FormEvent) {
    event.preventDefault();
    setStatus("");
    try {
      await api("/interview-schedules", {
        method: "POST",
        body: JSON.stringify({
          application_id: applicationId,
          starts_at: new Date(startsAt).toISOString(),
          duration_minutes: duration,
          timezone,
          meeting_url: meetingUrl.trim() || null,
        }),
      });
      setStatus("Interview proposal sent to the candidate.");
      setStartsAt(""); setMeetingUrl("");
      await load();
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Unable to propose interview"); }
  }

  async function update(id: string, action: "confirm" | "decline" | "cancel") {
    try {
      await api(`/interview-schedules/${id}`, { method: "PATCH", body: JSON.stringify({ action, candidate_note: note }) });
      setStatus(`Interview ${action === "confirm" ? "confirmed" : action === "decline" ? "declined" : "cancelled"}.`);
      setNote("");
      await load();
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Unable to update interview"); }
  }

  return (
    <section className="workspace">
      <div className="section-heading"><div><span className="eyebrow">INTERVIEWS</span><h2>Human interview scheduling</h2></div><span className="safe-badge">No face, voice or emotion scoring</span></div>
      {status && <div className="inline-notice" role="status">{status}</div>}
      {role === "recruiter" && <article className="panel schedule-form"><h3>Propose a time</h3><p>The candidate must explicitly confirm. Scheduling never changes their hiring stage.</p><form onSubmit={propose}>
        <label>Application ID<input value={applicationId} onChange={event => setApplicationId(event.target.value)} required /></label>
        <div className="two-fields"><label>Start time<input type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)} required /></label><label>Duration<select value={duration} onChange={event => setDuration(Number(event.target.value))}><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>60 minutes</option><option value={90}>90 minutes</option></select></label></div>
        <label>HTTPS meeting link<input type="url" value={meetingUrl} onChange={event => setMeetingUrl(event.target.value)} placeholder="https://meet.example.com/…" /></label>
        <button className="primary">Send proposal</button>
      </form></article>}
      <div className="schedule-list">
        {rows.map(row => <article className="panel schedule-card" key={row.id}><CalendarClock /><div><span className={`status ${row.status === "proposed" ? "warning" : ""}`}>{row.status}</span><h3>{row.job_title}</h3>{role === "recruiter" && <p>Candidate: {row.candidate_name}</p>}<strong>{new Date(row.starts_at).toLocaleString()} · {row.duration_minutes} minutes</strong><small>{row.timezone}</small>{row.candidate_note && <p>Candidate note: {row.candidate_note}</p>}
          {row.meeting_url && row.status === "confirmed" && <a className="text-link" href={row.meeting_url} target="_blank" rel="noreferrer">Open meeting <ExternalLink size={14} /></a>}
          {role === "candidate" && row.status === "proposed" && <><label>Optional note<textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Availability or accommodation note…" /></label><div className="button-row"><button className="primary" onClick={() => void update(row.id, "confirm")}><CheckCircle2 size={16} /> Confirm</button><button className="secondary" onClick={() => void update(row.id, "decline")}><XCircle size={16} /> Decline</button></div></>}
          {role === "recruiter" && ["proposed", "confirmed"].includes(row.status) && <button className="secondary" onClick={() => void update(row.id, "cancel")}>Cancel interview</button>}
        </div></article>)}
        {rows.length === 0 && <div className="empty-state"><CalendarClock /><h3>No scheduled interviews</h3><p>Confirmed and proposed interview times will appear here.</p></div>}
      </div>
    </section>
  );
}
