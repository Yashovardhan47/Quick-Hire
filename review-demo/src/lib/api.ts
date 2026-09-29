import { demoApi, demoSessionFor } from "./demo";

export type UserRole = "candidate" | "recruiter" | "admin";

export type SessionUser = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  email_verified: boolean;
};

export type Session = {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: SessionUser;
};

export type AuthConfig = {
  google_enabled: boolean;
  google_client_id: string | null;
  access_token_minutes: number;
  refresh_token_days: number;
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";
const SESSION_KEY = "quickhire.session";
const SESSION_EVENT = "quickhire:session";
let refreshInFlight: Promise<Session> | null = null;

export function eventSocketUrl(): string {
  return `${API_URL.replace(/^http/, "ws")}/ws/events`;
}

export function isDemoMode(): boolean {
  return DEMO_MODE;
}

export function getSession(): Session | null {
  try {
    const value = sessionStorage.getItem(SESSION_KEY);
    return value ? JSON.parse(value) as Session : null;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function saveSession(session: Session) {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function startDemoSession(role: UserRole): Session {
  const session = demoSessionFor(role) as Session;
  saveSession(session);
  return session;
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function subscribeToSession(listener: () => void) {
  window.addEventListener(SESSION_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(SESSION_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(typeof payload.detail === "string" ? payload.detail : "Request failed");
  }
  return response.json() as Promise<T>;
}

export async function refreshSession(): Promise<Session> {
  if (DEMO_MODE) {
    const session = getSession();
    if (session) return session;
    throw new Error("No active demo session");
  }
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then(parseResponse<Session>)
      .then(session => {
        saveSession(session);
        return session;
      })
      .catch(reason => {
        clearSession();
        throw reason;
      })
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

const cannotRefresh = new Set([
  "/auth/config",
  "/auth/login",
  "/auth/register",
  "/auth/google",
  "/auth/google/link",
  "/auth/refresh",
  "/auth/logout",
]);

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (DEMO_MODE) return demoApi(path, init) as Promise<T>;

  const send = async (session: Session | null) => {
    const headers = new Headers(init.headers);
    if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (session) headers.set("Authorization", `Bearer ${session.access_token}`);
    return fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });
  };

  let response = await send(getSession());
  if (response.status === 401 && getSession() && !cannotRefresh.has(path)) {
    try {
      const session = await refreshSession();
      response = await send(session);
    } catch {
      throw new Error("Your session expired. Please sign in again.");
    }
  }
  return parseResponse<T>(response);
}

export async function logoutSession(): Promise<void> {
  if (DEMO_MODE) {
    clearSession();
    return;
  }
  try {
    await api<void>("/auth/logout", { method: "POST" });
  } catch {
    // Local sign-out must still finish if the server session already expired.
  } finally {
    clearSession();
  }
}
