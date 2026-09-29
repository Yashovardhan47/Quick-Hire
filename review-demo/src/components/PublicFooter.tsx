import { BrainCircuit } from "lucide-react";
import { Link } from "react-router-dom";

export default function PublicFooter() {
  return (
    <footer className="public-footer">
      <div>
        <Link className="public-brand footer-brand" to="/"><span className="public-brand-mark"><BrainCircuit size={21} /></span><span>QuickHire<small>Jobs + recruiting</small></span></Link>
        <p>Job search, clear match explanations, and human-owned recruiting decisions.</p>
      </div>
      <div className="footer-links">
        <Link to="/jobs">Explore jobs</Link>
        <Link to="/login">Review dashboards</Link>
        <span>JWT + Google authentication</span>
        <span>Typed interviews only</span>
      </div>
      <div className="footer-policy">AI recommendations are advisory. QuickHire never makes autonomous employment decisions or evaluates biometric and protected traits.</div>
    </footer>
  );
}
