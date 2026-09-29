import type { UserRole } from "./api";

export type NotificationItem = {
  id: string;
  role: UserRole;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
};

const STORAGE_KEY = "quickhire.review.notifications.v1";
const NOTIFICATION_EVENT = "quickhire:notifications";
const PULSE_KEY = "quickhire.review.live-pulse";

const seedNotifications: NotificationItem[] = [
  {
    id: "seed-candidate-roadmap",
    role: "candidate",
    type: "roadmap.updated",
    title: "Your evidence roadmap is ready",
    message: "MLOps is the next highest-impact requirement for your Applied AI Engineer goal.",
    createdAt: new Date(Date.now() - 9 * 60_000).toISOString(),
    read: false,
  },
  {
    id: "seed-recruiter-evidence",
    role: "recruiter",
    type: "application.evidence_ready",
    title: "Candidate evidence refreshed",
    message: "Candidate QH-2071 completed an objective API-design check.",
    createdAt: new Date(Date.now() - 13 * 60_000).toISOString(),
    read: false,
  },
  {
    id: "seed-admin-policy",
    role: "admin",
    type: "governance.policy_check",
    title: "Policy controls verified",
    message: "Advisory-only decisions and typed-answer interview rules are active.",
    createdAt: new Date(Date.now() - 18 * 60_000).toISOString(),
    read: false,
  },
];

function readAll(includeReviewSeeds = false): NotificationItem[] {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    if (value) return JSON.parse(value) as NotificationItem[];
    if (includeReviewSeeds) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(seedNotifications));
  } catch {
    return includeReviewSeeds ? [...seedNotifications] : [];
  }
  return includeReviewSeeds ? [...seedNotifications] : [];
}

function writeAll(items: NotificationItem[]) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* Session storage is an enhancement, not a dependency. */ }
  window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT));
}

export function getNotifications(role: UserRole, includeReviewSeeds = false): NotificationItem[] {
  return readAll(includeReviewSeeds)
    .filter(item => item.role === role)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

export function pushNotification(item: Omit<NotificationItem, "id" | "createdAt" | "read">) {
  const notification: NotificationItem = {
    ...item,
    id: `${item.type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    read: false,
  };
  writeAll([notification, ...readAll()].slice(0, 40));
  return notification;
}

export function markNotificationsRead(role: UserRole) {
  writeAll(readAll().map(item => item.role === role ? { ...item, read: true } : item));
}

export function subscribeToNotifications(listener: () => void) {
  window.addEventListener(NOTIFICATION_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(NOTIFICATION_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function scheduleDemoLivePulse(role: UserRole) {
  const pulseId = `${PULSE_KEY}.${role}`;
  if (sessionStorage.getItem(pulseId)) return () => undefined;
  const timer = window.setTimeout(() => {
    sessionStorage.setItem(pulseId, "sent");
    const updates: Record<UserRole, Omit<NotificationItem, "id" | "createdAt" | "read" | "role">> = {
      candidate: {
        type: "recommendation.refreshed",
        title: "Recommendations recalculated",
        message: "Your fit, confidence, and roadmap now reflect the latest evidence in this session.",
      },
      recruiter: {
        type: "application.new",
        title: "Applicant queue synchronized",
        message: "The selected job pipeline and evidence analytics are up to date.",
      },
      admin: {
        type: "platform.health",
        title: "Live platform check completed",
        message: "Authentication, audit, and governance signals are responding normally.",
      },
    };
    pushNotification({ role, ...updates[role] });
  }, 2400);
  return () => window.clearTimeout(timer);
}

export function formatNotificationTime(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}
