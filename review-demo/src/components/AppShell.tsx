import { useCallback, useEffect, useState } from "react";
import { BarChart3, Bell, Bot, BrainCircuit, BriefcaseBusiness, CalendarDays, ClipboardList, Home, LayoutDashboard, LockKeyhole, LogOut, MessageSquareText, Search, ShieldCheck } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import GoogleAuthButton, { disableGoogleAutoSelect } from "./GoogleAuthButton";
import OnboardingTour from "./OnboardingTour";
import {
  api,
  AuthConfig,
  eventSocketUrl,
  getSession,
  isDemoMode,
  logoutSession,
  refreshSession,
  saveSession,
  Session,
  subscribeToSession,
} from "../lib/api";
import {
  formatNotificationTime,
  getNotifications,
  markNotificationsRead,
  NotificationItem,
  pushNotification,
  scheduleDemoLivePulse,
  subscribeToNotifications,
} from "../lib/liveState";

const linksByRole = {
  candidate: [
    { to: "/candidate", label: "My dashboard", icon: LayoutDashboard },
    { to: "/jobs", label: "Find jobs", icon: Search },
    { to: "/candidate/applications", label: "Applications", icon: ClipboardList },
    { to: "/candidate/interviews", label: "Interviews", icon: CalendarDays },
    { to: "/candidate/messages", label: "Messages", icon: MessageSquareText },
  ],
  recruiter: [
    { to: "/recruiter", label: "Jobs & applicants", icon: BriefcaseBusiness },
    { to: "/recruiter/assistant", label: "AI recruiter assistant", icon: Bot },
    { to: "/recruiter/interviews", label: "Interviews", icon: CalendarDays },
    { to: "/recruiter/messages", label: "Messages", icon: MessageSquareText },
  ],
  admin: [
    { to: "/admin", label: "Platform controls", icon: BarChart3 },
  ],
};

const roleLabels = { candidate: "Job seeker", recruiter: "Recruiter", admin: "Platform admin" };

export default function AppShell() {
  const navigate = useNavigate();
  const demo = isDemoMode();
  const [session, setSession] = useState<Session | null>(() => getSession());
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [linkMessage, setLinkMessage] = useState("");
  const user = session?.user;
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showEvents, setShowEvents] = useState(false);
  const visibleLinks = user ? linksByRole[user.role] : [];
  const unreadCount = notifications.filter(item => !item.read).length;

  useEffect(() => subscribeToSession(() => setSession(getSession())), []);
  useEffect(() => {
    if (demo) return;
    api<AuthConfig>("/auth/config").then(setAuthConfig).catch(() => undefined);
  }, [demo]);

  useEffect(() => {
    if (!user) { setNotifications([]); return; }
    const synchronize = () => setNotifications(getNotifications(user.role, demo));
    synchronize();
    const unsubscribe = subscribeToNotifications(synchronize);
    const cancelPulse = demo ? scheduleDemoLivePulse(user.role) : () => undefined;
    return () => { unsubscribe(); cancelPulse(); };
  }, [demo, user?.role]);

  useEffect(() => {
    if (demo || !session) return;
    const socket = new WebSocket(eventSocketUrl());
    socket.addEventListener("open", () => socket.send(JSON.stringify({ token: session.access_token })));
    socket.addEventListener("message", event => {
      try {
        const payload = JSON.parse(event.data) as { type?: string; status?: string; score?: number; message?: string };
        const eventType = payload.type ?? "platform.update";
        pushNotification({
          role: session.user.role,
          type: eventType,
          title: eventType.replaceAll(".", " "),
          message: payload.message ?? ([payload.status, payload.score !== undefined ? `${payload.score}%` : ""].filter(Boolean).join(" · ") || "Your workspace data has changed."),
        });
      } catch { /* Ignore malformed events. */ }
    });
    socket.addEventListener("close", event => {
      if (event.code === 4401) {
        void refreshSession().catch(() => navigate("/login"));
      }
    });
    return () => socket.close();
  }, [demo, navigate, session?.access_token]);

  const handleGoogleLink = useCallback(async (credential: string) => {
    setLinkMessage("");
    try {
      await api<void>("/auth/google/link", { method: "POST", body: JSON.stringify({ credential }) });
      if (session) saveSession({ ...session, user: { ...session.user, email_verified: true } });
      setLinkMessage("Google account linked.");
    } catch (reason) {
      setLinkMessage(reason instanceof Error ? reason.message : "Unable to link Google");
    }
  }, [session]);

  const handleGoogleError = useCallback((message: string) => setLinkMessage(message), []);

  async function logout() {
    await logoutSession();
    disableGoogleAutoSelect();
    navigate("/login");
  }

  function markAllRead() {
    if (!user) return;
    markNotificationsRead(user.role);
  }

  return (
    <div className="app-shell">
      {user && <OnboardingTour role={user.role} />}
      <aside className="sidebar">
        <div className="brand"><BrainCircuit size={24} /> <span>QuickHire</span></div>
        <p className="brand-note">Jobs + recruiting</p>
        <nav className="platform-nav" aria-label="Platform navigation">
          <NavLink to="/"><Home size={18} /> Home</NavLink>
        </nav>
        <span className="sidebar-label">{user ? roleLabels[user.role] : "Workspace"}</span>
        <nav aria-label="Workspace navigation">
          {visibleLinks.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? "active" : ""}>
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        {demo && user && <div className="review-role-lock"><LockKeyhole size={17} /><p><strong>{roleLabels[user.role]} perspective locked</strong><small>Only this role's navigation and workflows are available. Exit to choose another perspective.</small></p></div>}
        <div className="decision-note">
          <ShieldCheck size={18} />
          <p>AI helps explain and prepare. People make every hiring decision.</p>
        </div>
        {authConfig?.google_enabled && authConfig.google_client_id && !user?.email_verified && (
          <div className="identity-link">
            <span>Secure this account</span>
            <GoogleAuthButton clientId={authConfig.google_client_id} onCredential={handleGoogleLink} onError={handleGoogleError} width={190} />
            {linkMessage && <small>{linkMessage}</small>}
          </div>
        )}
        <button className="logout-button" onClick={() => void logout()}><LogOut size={17} /> {demo ? "Exit demo" : "Sign out"}</button>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <span className="eyebrow">{user ? roleLabels[user.role].toUpperCase() : "QUICKHIRE"} WORKSPACE</span>
            <h1>{user?.full_name}</h1>
          </div>
          {demo && <span className="demo-topbar-badge">Updated role-scoped review · live jobs + sample account data</span>}
          <div className="notification-wrap">
            <button className="icon-button" aria-label="Notifications" aria-expanded={showEvents} onClick={() => setShowEvents(!showEvents)}><Bell size={20} />{unreadCount > 0 && <span>{unreadCount}</span>}</button>
            {showEvents && <div className="notification-panel">
              <div className="notification-head"><div><strong>Live updates</strong><small>{unreadCount} unread</small></div>{unreadCount > 0 && <button type="button" onClick={markAllRead}>Mark all read</button>}</div>
              {notifications.length === 0 ? <p className="notification-empty">No new events.</p> : <div className="notification-list">{notifications.map(item => <article className={item.read ? "read" : ""} key={item.id}><span className="notification-dot" /><div><strong>{item.title}</strong><p>{item.message}</p><small>{formatNotificationTime(item.createdAt)} · {item.type.replaceAll(".", " ")}</small></div></article>)}</div>}
            </div>}
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
