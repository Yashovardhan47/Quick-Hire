import { FormEvent, useState } from "react";
import { BrainCircuit, ShieldCheck, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, saveSession, Session, UserRole } from "../lib/api";

const homeFor = (role: UserRole) => `/${role}`;

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"candidate" | "recruiter">("candidate");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError("");
    try {
      const payload = mode === "login"
        ? { email, password }
        : { email, password, full_name: fullName, role };
      const session = await api<Session>(`/auth/${mode}`, { method: "POST", body: JSON.stringify(payload) });
      saveSession(session);
      navigate(homeFor(session.user.role));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to continue");
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="brand"><BrainCircuit size={28} /> <span>QuickHire</span></div>
        <div>
          <span className="eyebrow mint">EVIDENCEGRAPH</span>
          <h1>Hiring intelligence that shows its work.</h1>
          <p>Match requirements to evidence, verify uncertainty with targeted checks, and keep consequential decisions with people.</p>
        </div>
        <div className="trust-line"><ShieldCheck size={20} /> Protected traits are excluded from ranking.</div>
      </section>
      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          <Sparkles size={24} />
          <h2>{mode === "login" ? "Welcome back" : "Create your workspace"}</h2>
          <p>{mode === "login" ? "Sign in to your role-specific dashboard." : "Choose how you will use QuickHire."}</p>
          {mode === "register" && (
            <>
              <label>Full name<input value={fullName} onChange={event => setFullName(event.target.value)} minLength={2} required /></label>
              <fieldset className="role-picker">
                <legend>Account type</legend>
                <button type="button" className={role === "candidate" ? "selected" : ""} onClick={() => setRole("candidate")}>Job seeker</button>
                <button type="button" className={role === "recruiter" ? "selected" : ""} onClick={() => setRole("recruiter")}>Recruiter</button>
              </fieldset>
            </>
          )}
          <label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={10} required /></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary wide" disabled={working}>{working ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
          <button type="button" className="text-button auth-switch" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "New to QuickHire? Create an account" : "Already have an account? Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
