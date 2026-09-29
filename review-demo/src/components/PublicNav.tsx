import { BrainCircuit, BriefcaseBusiness, Menu, UserRoundSearch, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { startDemoSession, UserRole } from "../lib/api";

type PublicNavProps = {
  onSection?: (id: string) => void;
};

export default function PublicNav({ onSection }: PublicNavProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function openWorkspace(role: UserRole) {
    startDemoSession(role);
    setOpen(false);
    navigate(`/${role}`);
  }

  function jump(id: string) {
    setOpen(false);
    if (onSection) onSection(id);
    else navigate(`/?section=${id}`);
  }

  return (
    <header className="public-header">
      <div className="public-nav">
        <Link className="public-brand" to="/" aria-label="QuickHire home">
          <span className="public-brand-mark"><BrainCircuit size={21} /></span>
          <span>QuickHire<small>Jobs + recruiting</small></span>
        </Link>
        <button className="mobile-nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
        <nav className={open ? "public-links open" : "public-links"} aria-label="Primary navigation">
          <Link to="/jobs" onClick={() => setOpen(false)}>Find jobs</Link>
          <button type="button" onClick={() => jump("overview")}>How it works</button>
          <button type="button" onClick={() => openWorkspace("candidate")}><UserRoundSearch size={16} /> For job seekers</button>
          <button type="button" onClick={() => openWorkspace("recruiter")}><BriefcaseBusiness size={16} /> For recruiters</button>
        </nav>
        <div className="public-actions">
          <Link className="nav-signin" to="/login">Sign in</Link>
          <button className="nav-demo" type="button" onClick={() => openWorkspace("candidate")}>Open live demo</button>
        </div>
      </div>
    </header>
  );
}
