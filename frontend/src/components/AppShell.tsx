import { Bell, BrainCircuit, BriefcaseBusiness, ShieldCheck, UserRoundSearch } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const links = [
  { to: "/candidate", label: "Candidate", icon: UserRoundSearch },
  { to: "/recruiter", label: "Recruiter", icon: BriefcaseBusiness },
  { to: "/admin", label: "Platform admin", icon: ShieldCheck },
];

export default function AppShell() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><BrainCircuit size={24} /> <span>QuickHire</span></div>
        <p className="brand-note">EvidenceGraph</p>
        <nav aria-label="Dashboard previews">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? "active" : ""}>
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="decision-note">
          <ShieldCheck size={18} />
          <p>AI explains evidence. People make hiring decisions.</p>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <span className="eyebrow">FOUNDATION PREVIEW</span>
            <h1>Recruitment intelligence workspace</h1>
          </div>
          <button className="icon-button" aria-label="Notifications"><Bell size={20} /></button>
        </header>
        <Outlet />
      </main>
    </div>
  );
}

