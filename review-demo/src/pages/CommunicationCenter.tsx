import { BellRing, CalendarDays, CheckCircle2, Clock3, Download, MapPin, MessageSquareText, Send, ShieldCheck, UserRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSession } from "../lib/api";
import {
  confirmScheduledInterview,
  Conversation,
  createScheduledInterview,
  downloadInterviewCalendar,
  enableDesktopNotifications,
  getConversations,
  getScheduledInterviews,
  ScheduledInterview,
  sendWorkflowMessage,
  subscribeToWorkflow,
} from "../lib/workflowState";

const tomorrowAtTen = () => {
  const value = new Date(Date.now() + 24 * 60 * 60_000);
  value.setHours(10, 0, 0, 0);
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export default function CommunicationCenter({ mode }: { mode: "messages" | "interviews" }) {
  const session = getSession();
  const role = session?.user.role === "recruiter" ? "recruiter" : "candidate";
  const [conversations, setConversations] = useState<Conversation[]>(() => getConversations());
  const [interviews, setInterviews] = useState<ScheduledInterview[]>(() => getScheduledInterviews());
  const [selectedConversationId, setSelectedConversationId] = useState(() => conversations[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [jobId, setJobId] = useState("job-ai-01");
  const [scheduledAt, setScheduledAt] = useState(tomorrowAtTen);
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [interviewMode, setInterviewMode] = useState<ScheduledInterview["mode"]>("Video");
  const [agenda, setAgenda] = useState("Discuss job-related projects, technical decisions, and the requirements that still need clarification.");

  useEffect(() => subscribeToWorkflow(() => {
    setConversations(getConversations());
    setInterviews(getScheduledInterviews());
  }), []);

  const selectedConversation = conversations.find(item => item.id === selectedConversationId) ?? conversations[0];
  const selectedJobConversation = conversations.find(item => item.jobId === jobId) ?? conversations[0];
  const upcoming = useMemo(() => interviews.filter(item => item.status !== "completed"), [interviews]);

  function send(event: FormEvent) {
    event.preventDefault();
    if (!selectedConversation || !message.trim()) return;
    sendWorkflowMessage(selectedConversation.id, role, message);
    setMessage("");
    setNotice("Message sent and the other workspace received a notification.");
  }

  function schedule(event: FormEvent) {
    event.preventDefault();
    if (!selectedJobConversation) return;
    const interview = createScheduledInterview({
      jobId: selectedJobConversation.jobId,
      jobTitle: selectedJobConversation.jobTitle,
      company: selectedJobConversation.company,
      candidateName: selectedJobConversation.candidateName,
      recruiterName: selectedJobConversation.recruiterName,
      scheduledAt: new Date(scheduledAt).toISOString(),
      durationMinutes,
      mode: interviewMode,
      agenda,
    }, role);
    setNotice(role === "recruiter" ? "Interview scheduled and the candidate was notified." : "Your availability request was sent to the recruiter.");
    if (role === "recruiter") downloadInterviewCalendar(interview);
  }

  async function enableAlerts() {
    setNotice(await enableDesktopNotifications());
  }

  return (
    <section className="workspace communication-page">
      <div className="section-heading">
        <div><span className="eyebrow">{mode === "messages" ? "MESSAGES" : "INTERVIEWS"}</span><h2>{mode === "messages" ? "Keep every job conversation in one place" : "Plan and track interviews clearly"}</h2></div>
        <button type="button" className="secondary" onClick={() => void enableAlerts()}><BellRing size={17} /> Enable desktop alerts</button>
      </div>
      {notice && <div className="inline-notice" role="status">{notice}</div>}

      {mode === "messages" ? <div className="message-center">
        <aside className="conversation-list">
          <div><span className="eyebrow">JOB CONVERSATIONS</span><strong>{conversations.length}</strong></div>
          {conversations.map(conversation => {
            const last = conversation.messages.at(-1);
            const counterpart = role === "candidate" ? conversation.recruiterName : conversation.candidateName;
            return <button type="button" className={selectedConversation?.id === conversation.id ? "active" : ""} onClick={() => setSelectedConversationId(conversation.id)} key={conversation.id}><span className="avatar-mark small">{counterpart.split(" ").map(part => part[0]).join("").slice(0, 2)}</span><span><strong>{counterpart}</strong><small>{conversation.jobTitle}</small><p>{last?.body}</p></span></button>;
          })}
        </aside>
        {selectedConversation && <article className="message-thread panel">
          <header><div><span className="avatar-mark">{(role === "candidate" ? selectedConversation.recruiterName : selectedConversation.candidateName).split(" ").map(part => part[0]).join("").slice(0, 2)}</span><p><strong>{role === "candidate" ? selectedConversation.recruiterName : selectedConversation.candidateName}</strong><span>{selectedConversation.jobTitle} · {selectedConversation.company}</span></p></div><span className="safe-badge"><ShieldCheck size={14} /> Job-related conversation</span></header>
          <div className="message-scroll">{selectedConversation.messages.map(item => <div className={`message-bubble ${item.senderRole === role ? "mine" : ""}`} key={item.id}><strong>{item.senderName}</strong><p>{item.body}</p><small>{new Date(item.sentAt).toLocaleString()}</small></div>)}</div>
          <form className="message-composer" onSubmit={send}><textarea value={message} onChange={event => setMessage(event.target.value)} minLength={2} placeholder="Write a job-related message…" required /><button className="primary" aria-label="Send message"><Send size={18} /></button></form>
        </article>}
      </div> : <div className="interview-center">
        <div className="interview-list">
          <div className="subheading"><div><span className="eyebrow">UPCOMING</span><h3>{upcoming.length} interview update{upcoming.length === 1 ? "" : "s"}</h3></div></div>
          {upcoming.map(interview => <article className="interview-card" key={interview.id}>
            <div className="interview-date"><strong>{new Date(interview.scheduledAt).toLocaleDateString(undefined, { day: "2-digit" })}</strong><span>{new Date(interview.scheduledAt).toLocaleDateString(undefined, { month: "short" })}</span></div>
            <div className="interview-main"><span className={`status ${interview.status === "requested" ? "warning" : ""}`}>{interview.status}</span><h3>{interview.jobTitle}</h3><p>{interview.company} · {role === "candidate" ? interview.recruiterName : interview.candidateName}</p><div><span><Clock3 /> {new Date(interview.scheduledAt).toLocaleString()} · {interview.durationMinutes} min</span><span><MapPin /> {interview.mode}</span></div><p className="interview-agenda">{interview.agenda}</p></div>
            <div className="interview-actions">{interview.status === "requested" && role === "recruiter" && <button className="primary" type="button" onClick={() => { confirmScheduledInterview(interview.id); setNotice("Interview request confirmed and the candidate was notified."); }}><CheckCircle2 size={16} /> Confirm</button>}{interview.status === "confirmed" && <button className="secondary" type="button" onClick={() => downloadInterviewCalendar(interview)}><Download size={16} /> Add to calendar</button>}</div>
          </article>)}
        </div>
        <form className="panel interview-scheduler" onSubmit={schedule}>
          <CalendarDays />
          <span className="eyebrow">{role === "candidate" ? "REQUEST AVAILABILITY" : "SCHEDULE INTERVIEW"}</span>
          <h3>{role === "candidate" ? "Suggest a suitable time" : "Create a clear interview plan"}</h3>
          <label>Job<select value={jobId} onChange={event => setJobId(event.target.value)}>{conversations.map(item => <option key={item.jobId} value={item.jobId}>{item.jobTitle} · {item.company}</option>)}</select></label>
          <label>Date and time<input type="datetime-local" value={scheduledAt} onChange={event => setScheduledAt(event.target.value)} min={new Date().toISOString().slice(0, 16)} required /></label>
          <div className="two-fields"><label>Duration<select value={durationMinutes} onChange={event => setDurationMinutes(Number(event.target.value))}><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>60 minutes</option></select></label><label>Mode<select value={interviewMode} onChange={event => setInterviewMode(event.target.value as ScheduledInterview["mode"])}><option>Video</option><option>Phone</option><option>On-site</option></select></label></div>
          <label>Job-related agenda<textarea value={agenda} onChange={event => setAgenda(event.target.value)} minLength={20} required /></label>
          <div className="decision-confirm"><ShieldCheck /><span>Interview questions must stay job-related. No biometric, personality, emotion, accent, disability, or honesty scoring.</span></div>
          <button className="primary">{role === "candidate" ? <><Send size={17} /> Send request</> : <><CalendarDays size={17} /> Schedule and notify</>}</button>
        </form>
      </div>}
    </section>
  );
}
