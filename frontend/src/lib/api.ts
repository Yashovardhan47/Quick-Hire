export type UserRole = "candidate" | "recruiter" | "admin";

export type SessionUser = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
};

export type Session = {
  access_token: string;
  token_type: string;
  user: SessionUser;
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";
const SESSION_KEY = "quickhire.session";

export function eventSocketUrl(): string {
  return `${API_URL.replace(/^http/, "ws")}/ws/events`;
}

export function getSession(): Session | null {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    return value ? JSON.parse(value) as Session : null;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function saveSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = getSession();
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (session) headers.set("Authorization", `Bearer ${session.access_token}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(typeof payload.detail === "string" ? payload.detail : "Request failed");
  }
  return response.json() as Promise<T>;
}
