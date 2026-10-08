export type UserRole = "candidate" | "recruiter" | "admin";

export type SessionUser = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  email_verified: boolean;
  google_linked: boolean;
};

export type Session = {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: SessionUser;
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";
const SESSION_KEY = "quickhire.session";
const NO_REFRESH_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/google",
  "/auth/refresh",
  "/auth/email-verification/confirm",
  "/auth/password/forgot",
  "/auth/password/reset",
]);
let refreshInFlight: Promise<Session | null> | null = null;

export function eventSocketUrl(): string {
  return `${API_URL.replace(/^http/, "ws")}/ws/events`;
}

export function getSession(): Session | null {
  try {
    const current = sessionStorage.getItem(SESSION_KEY);
    if (current) return JSON.parse(current) as Session;
    const legacy = localStorage.getItem(SESSION_KEY);
    if (!legacy) return null;
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.setItem(SESSION_KEY, legacy);
    return JSON.parse(legacy) as Session;
  } catch {
    clearSession();
    return null;
  }
}

export function saveSession(session: Session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.removeItem(SESSION_KEY);
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}

async function errorMessage(response: Response): Promise<string> {
  const payload = await response.json().catch(() => ({ detail: "Request failed" }));
  if (typeof payload.detail === "string") return payload.detail;
  return "Request failed";
}

function decodeAccessTokenPayload(token: string): { exp?: number; token_type?: string } {
  const encoded = token.split(".")[1];
  if (!encoded) throw new Error("Malformed access token");
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return JSON.parse(atob(padded)) as { exp?: number; token_type?: string };
}

export function refreshSession(): Promise<Session | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        clearSession();
        return null;
      }
      const session = await response.json() as Session;
      saveSession(session);
      return session;
    } catch {
      clearSession();
      return null;
    }
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

export async function ensureActiveSession(): Promise<Session | null> {
  const session = getSession();
  if (session) {
    try {
      const payload = decodeAccessTokenPayload(session.access_token);
      if (payload.token_type === "access" && (payload.exp ?? 0) * 1000 > Date.now() + 15_000) {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          credentials: "include",
        });
        if (response.ok) {
          const user = await response.json() as SessionUser;
          const authoritative = { ...session, user };
          saveSession(authoritative);
          return authoritative;
        }
        if (response.status === 401) return refreshSession();
        clearSession();
        return null;
      }
    } catch { /* Refresh malformed or legacy access tokens. */ }
  }
  return refreshSession();
}

export async function logoutSession(): Promise<void> {
  try {
    await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" });
  } finally {
    clearSession();
  }
}

export async function api<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const session = getSession();
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (session) headers.set("Authorization", `Bearer ${session.access_token}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });
  if (response.status === 401 && !retried && !NO_REFRESH_PATHS.has(path)) {
    const refreshed = await refreshSession();
    if (refreshed) return api<T>(path, init, true);
  }
  if (!response.ok) throw new Error(await errorMessage(response));
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
