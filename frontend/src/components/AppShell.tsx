import { useEffect, useState } from "react";
import { Bell, BrainCircuit, BriefcaseBusiness, LogOut, ShieldCheck, UserRoundSearch } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearSession, eventSocketUrl, getSession } from "../lib/api";

const links = [
  { to: "/candidate", label: "Candidate", icon: UserRoundSearch },
  { to: "/recruiter", label: "Recruiter", icon: BriefcaseBusiness },
  { to: "/admin", label: "Platform admin", icon: ShieldCheck },
];

export default function AppShell() {
  const navigate = useNavigate();
  const session = getSession();
  const user = session?.user;
  const [events, setEvents] = useState<{ type: string; status?: string; score?: number }[]>([]);
  const [showEvents, setShowEvents] = useState(false);
  const visibleLinks = links.filter(link => link.to === `/${user?.role}`);

  useEffect(() => {
    if (!session) return;
    const socket = new WebSocket(eventSocketUrl());
    socket.addEventListener("open", () => socket.send(JSON.stringify({ token: session.access_token })));
    socket.addEventListener("message", event => {
      try { setEvents(current => [JSON.parse(event.data), ...current].slice(0, 12)); } catch { /* Ignore malformed events. */ }
    });
    return () => socket.close();
  }, [session?.access_token]);

  function logout() {
    clearSession();
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
        <button className="logout-button" onClick={logout}><LogOut size={17} /> Sign out</button>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <span className="eyebrow">{user?.role.toUpperCase()} WORKSPACE</span>
            <h1>{user?.full_name}</h1>
          </div>
          <div className="notification-wrap">
            <button className="icon-button" aria-label="Notifications" onClick={() => setShowEvents(!showEvents)}><Bell size={20} />{events.length > 0 && <span>{events.length}</span>}</button>
            {showEvents && <div className="notification-panel"><strong>Live updates</strong>{events.length === 0 ? <p>No new events.</p> : events.map((event, index) => <p key={`${event.type}-${index}`}>{event.type.replaceAll(".", " ")}{event.status ? ` · ${event.status}` : ""}{event.score !== undefined ? ` · ${event.score}%` : ""}</p>)}</div>}
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
