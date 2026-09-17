import { useEffect, useRef, useState } from "react";
import { Bell, Bot, BrainCircuit, BriefcaseBusiness, CalendarClock, KeyRound, LogOut, MessageCircle, ShieldCheck, UserRoundSearch } from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { api, eventSocketUrl, getSession, logoutSession } from "../lib/api";

const roleLinks = {
  candidate: [
    { to: "/candidate", label: "Opportunities", icon: UserRoundSearch },
    { to: "/candidate/messages", label: "Messages", icon: MessageCircle },
    { to: "/candidate/interviews", label: "Interviews", icon: CalendarClock },
  ],
  recruiter: [
    { to: "/recruiter", label: "Jobs & applicants", icon: BriefcaseBusiness },
    { to: "/recruiter/assistant", label: "AI assistant", icon: Bot },
    { to: "/recruiter/messages", label: "Messages", icon: MessageCircle },
    { to: "/recruiter/interviews", label: "Interviews", icon: CalendarClock },
  ],
  admin: [{ to: "/admin", label: "Governance", icon: ShieldCheck }],
};

type StoredNotification = { id: string; title: string; body: string; created_at: string; read_at: string | null };

export default function AppShell() {
  const navigate = useNavigate();
  const session = getSession();
  const user = session?.user;
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);
  const [showEvents, setShowEvents] = useState(false);
  const browserAlerts = useRef(false);
  const visibleLinks = user ? [
    ...roleLinks[user.role],
    { to: "/notifications", label: "Notifications", icon: Bell },
    { to: "/account", label: "Account & safety", icon: KeyRound },
  ] : [];

  async function loadNotifications() {
    try { setNotifications(await api<StoredNotification[]>("/notifications?unread_only=true")); }
    catch { /* Authentication refresh handles transient failures; the full page exposes errors. */ }
  }

  useEffect(() => {
    void loadNotifications();
    const durablePoll = window.setInterval(() => void loadNotifications(), 30_000);
    void api<{ browser_enabled: boolean }>("/notifications/preferences")
      .then(preferences => { browserAlerts.current = preferences.browser_enabled; })
      .catch(() => undefined);
    const updateBrowserPreference = (event: Event) => { browserAlerts.current = Boolean((event as CustomEvent).detail); };
    window.addEventListener("quickhire:browser-preference", updateBrowserPreference);
    return () => {
      window.clearInterval(durablePoll);
      window.removeEventListener("quickhire:browser-preference", updateBrowserPreference);
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    let socket: WebSocket | null = null;
    let reconnectTimer = 0;
    let heartbeat = 0;
    let stopped = false;
    const connect = () => {
      socket = new WebSocket(eventSocketUrl());
      socket.addEventListener("open", () => {
        socket?.send(JSON.stringify({ token: getSession()?.access_token ?? session.access_token }));
        heartbeat = window.setInterval(() => socket?.readyState === WebSocket.OPEN && socket.send("ping"), 25_000);
      });
      socket.addEventListener("message", () => {
        void loadNotifications();
        if (browserAlerts.current && "Notification" in window && window.Notification.permission === "granted") {
          new window.Notification("QuickHire update", { body: "Open QuickHire to view the latest workflow update." });
        }
      });
      socket.addEventListener("close", () => {
        window.clearInterval(heartbeat);
        if (!stopped) reconnectTimer = window.setTimeout(connect, 3_000);
      });
    };
    connect();
    return () => { stopped = true; window.clearTimeout(reconnectTimer); window.clearInterval(heartbeat); socket?.close(); };
  }, [session?.access_token]);

  async function logout() {
    await logoutSession();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><BrainCircuit size={24} /> <span>QuickHire</span></div>
        <p className="brand-note">EvidenceGraph</p>
        <nav aria-label="Dashboard previews">
          {visibleLinks.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? "active" : ""}>
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="decision-note">
          <ShieldCheck size={18} />
          <p>AI explains evidence. People make hiring decisions.</p>
        </div>
        <button className="logout-button" onClick={() => void logout()}><LogOut size={17} /> Sign out</button>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <span className="eyebrow">{user?.role.toUpperCase()} WORKSPACE</span>
            <h1>{user?.full_name}</h1>
          </div>
          <div className="notification-wrap">
            <button className="icon-button" aria-label="Notifications" onClick={() => setShowEvents(!showEvents)}><Bell size={20} />{notifications.length > 0 && <span>{notifications.length}</span>}</button>
            {showEvents && <div className="notification-panel"><strong>Unread updates</strong>{notifications.length === 0 ? <p>No unread notifications.</p> : notifications.slice(0, 5).map(item => <div className="notification-preview" key={item.id}><b>{item.title}</b><p>{item.body}</p></div>)}<Link className="text-link" to="/notifications" onClick={() => setShowEvents(false)}>View notification center</Link></div>}
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
