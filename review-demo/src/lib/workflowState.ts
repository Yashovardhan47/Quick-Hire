import type { UserRole } from "./api";
import { pushNotification } from "./liveState";

export type WorkflowMessage = {
  id: string;
  senderRole: "candidate" | "recruiter";
  senderName: string;
  body: string;
  sentAt: string;
};

export type Conversation = {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  candidateName: string;
  recruiterName: string;
  messages: WorkflowMessage[];
};

export type ScheduledInterview = {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  candidateName: string;
  recruiterName: string;
  scheduledAt: string;
  durationMinutes: number;
  mode: "Video" | "Phone" | "On-site";
  status: "requested" | "confirmed" | "completed";
  agenda: string;
};

const MESSAGE_KEY = "quickhire.review.conversations.v1";
const INTERVIEW_KEY = "quickhire.review.interviews.v1";
const WORKFLOW_EVENT = "quickhire:workflow";

const seedConversations: Conversation[] = [
  {
    id: "conversation-ai-engineer",
    jobId: "job-ai-01",
    jobTitle: "Applied AI Engineer",
    company: "Aster Labs",
    candidateName: "Aarav Mehta",
    recruiterName: "Priya Sharma",
    messages: [
      { id: "message-1", senderRole: "recruiter", senderName: "Priya Sharma", body: "Thanks for applying. Please complete the short MLOps check before we review the next step.", sentAt: new Date(Date.now() - 46 * 60_000).toISOString() },
      { id: "message-2", senderRole: "candidate", senderName: "Aarav Mehta", body: "Thank you. I have completed the objective questions and submitted the system-design answer for human review.", sentAt: new Date(Date.now() - 31 * 60_000).toISOString() },
    ],
  },
  {
    id: "conversation-data-scientist",
    jobId: "job-ds-02",
    jobTitle: "Product Data Scientist",
    company: "Northstar Commerce",
    candidateName: "Aarav Mehta",
    recruiterName: "Meera Rao",
    messages: [
      { id: "message-3", senderRole: "recruiter", senderName: "Meera Rao", body: "Your application is under review. We will contact you here if the team needs additional project evidence.", sentAt: new Date(Date.now() - 22 * 60 * 60_000).toISOString() },
    ],
  },
];

const seedInterviews: ScheduledInterview[] = [
  {
    id: "interview-upcoming-1",
    jobId: "job-ai-01",
    jobTitle: "Applied AI Engineer",
    company: "Aster Labs",
    candidateName: "Aarav Mehta",
    recruiterName: "Priya Sharma",
    scheduledAt: new Date(Date.now() + 27 * 60 * 60_000).toISOString(),
    durationMinutes: 45,
    mode: "Video",
    status: "confirmed",
    agenda: "Python service design, model monitoring, and job-related project evidence.",
  },
];

function load<T>(key: string, fallback: T): T {
  try {
    const value = sessionStorage.getItem(key);
    if (value) return JSON.parse(value) as T;
    sessionStorage.setItem(key, JSON.stringify(fallback));
  } catch { return structuredClone(fallback); }
  return structuredClone(fallback);
}

function save<T>(key: string, value: T) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Review state can still remain in memory for this page. */ }
  window.dispatchEvent(new CustomEvent(WORKFLOW_EVENT));
}

export function getConversations() {
  return load(MESSAGE_KEY, seedConversations);
}

export function sendWorkflowMessage(conversationId: string, senderRole: "candidate" | "recruiter", body: string) {
  const conversations = getConversations();
  const conversation = conversations.find(item => item.id === conversationId);
  if (!conversation) throw new Error("Conversation not found");
  const senderName = senderRole === "candidate" ? conversation.candidateName : conversation.recruiterName;
  conversation.messages.push({ id: `message-${Date.now()}`, senderRole, senderName, body: body.trim(), sentAt: new Date().toISOString() });
  save(MESSAGE_KEY, conversations);
  const recipient: UserRole = senderRole === "candidate" ? "recruiter" : "candidate";
  pushNotification({ role: recipient, type: "message.received", title: `New message about ${conversation.jobTitle}`, message: `${senderName}: ${body.trim().slice(0, 90)}` });
  notifyDesktop("QuickHire message", `${senderName}: ${body.trim().slice(0, 90)}`);
  return conversation;
}

export function getScheduledInterviews() {
  return load(INTERVIEW_KEY, seedInterviews).sort((left, right) => Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt));
}

export function createScheduledInterview(input: Omit<ScheduledInterview, "id" | "status">, createdBy: "candidate" | "recruiter") {
  const interview: ScheduledInterview = {
    ...input,
    id: `interview-${Date.now()}`,
    status: createdBy === "recruiter" ? "confirmed" : "requested",
  };
  save(INTERVIEW_KEY, [...getScheduledInterviews(), interview]);
  pushNotification({
    role: createdBy === "candidate" ? "recruiter" : "candidate",
    type: createdBy === "candidate" ? "interview.availability_requested" : "interview.scheduled",
    title: createdBy === "candidate" ? "Interview availability received" : "Interview scheduled",
    message: `${interview.jobTitle} · ${new Date(interview.scheduledAt).toLocaleString()}`,
  });
  notifyDesktop("QuickHire interview update", `${interview.jobTitle} · ${new Date(interview.scheduledAt).toLocaleString()}`);
  return interview;
}

export function confirmScheduledInterview(interviewId: string) {
  const interviews = getScheduledInterviews();
  const interview = interviews.find(item => item.id === interviewId);
  if (!interview) throw new Error("Interview not found");
  interview.status = "confirmed";
  save(INTERVIEW_KEY, interviews);
  pushNotification({ role: "candidate", type: "interview.confirmed", title: "Interview request confirmed", message: `${interview.jobTitle} · ${new Date(interview.scheduledAt).toLocaleString()}` });
  return interview;
}

export function subscribeToWorkflow(listener: () => void) {
  window.addEventListener(WORKFLOW_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(WORKFLOW_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export async function enableDesktopNotifications() {
  if (!("Notification" in window)) return "Desktop notifications are not supported by this browser.";
  const permission = await Notification.requestPermission();
  return permission === "granted" ? "Desktop notifications enabled." : "Desktop notifications were not enabled.";
}

function notifyDesktop(title: string, body: string) {
  if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body });
}

export function downloadInterviewCalendar(interview: ScheduledInterview) {
  const start = new Date(interview.scheduledAt);
  const end = new Date(start.getTime() + interview.durationMinutes * 60_000);
  const stamp = (value: Date) => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const escape = (value: string) => value.replaceAll("\\", "\\\\").replaceAll(",", "\\,").replaceAll(";", "\\;").replaceAll("\n", "\\n");
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//QuickHire//Interview Calendar//EN",
    "BEGIN:VEVENT",
    `UID:${interview.id}@quickhire`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(`${interview.jobTitle} interview`)}`,
    `DESCRIPTION:${escape(interview.agenda)}`,
    `LOCATION:${escape(interview.mode)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `quickhire-${interview.jobTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`;
  anchor.click();
  URL.revokeObjectURL(url);
}
