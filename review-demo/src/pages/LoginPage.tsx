import { FormEvent, useCallback, useEffect, useState } from "react";
import { BrainCircuit, BriefcaseBusiness, Fingerprint, KeyRound, LockKeyhole, RefreshCw, ShieldCheck, Sparkles, UserRoundSearch } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import GoogleAuthButton from "../components/GoogleAuthButton";
import { api, AuthConfig, getSession, isDemoMode, refreshSession, saveSession, Session, startDemoSession, UserRole } from "../lib/api";

const homeFor = (role: UserRole) => `/${role}`;

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const demo = isDemoMode();
  const requestedRole = searchParams.get("role");
  const initialRole: UserRole = requestedRole === "recruiter" || requestedRole === "admin" ? requestedRole : "candidate";
  const [mode, setMode] = useState<"login" | "register">(searchParams.get("mode") === "register" ? "register" : "login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(initialRole);
  const [error, setError] = useState("");
  const [googleError, setGoogleError] = useState("");
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (demo) return;
    api<AuthConfig>("/auth/config")
      .then(setAuthConfig)
      .catch(() => setGoogleError("Google sign-in is temporarily unavailable. Email sign-in still works."));
  }, [demo]);

  useEffect(() => {
    if (demo) return;
    if (getSession()) return;
    void refreshSession()
      .then(session => navigate(homeFor(session.user.role), { replace: true }))
      .catch(() => undefined);
  }, [demo, navigate]);

  const handleGoogleError = useCallback((message: string) => setGoogleError(message), []);

  const handleGoogleCredential = useCallback(async (credential: string) => {
    setWorking(true);
    setError("");
    setGoogleError("");
    try {
      const session = await api<Session>("/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential, ...(mode === "register" ? { role } : {}) }),
      });
      saveSession(session);
      navigate(homeFor(session.user.role));
    } catch (reason) {
      setGoogleError(reason instanceof Error ? reason.message : "Unable to continue with Google");
    } finally {
      setWorking(false);
    }
  }, [mode, navigate, role]);

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

  function openDemo(nextRole: UserRole) {
    startDemoSession(nextRole);
    navigate(homeFor(nextRole));
  }

  if (demo) {
    return (
      <main className="auth-page demo-auth-page">
        <section className="auth-story">
          <div className="brand"><BrainCircuit size={28} /> <span>QuickHire</span></div>
          <div>
            <span className="eyebrow mint">QUICKHIRE REVIEW</span>
            <h1>Find jobs, understand your match, and recruit responsibly.</h1>
            <p>Explore job search, skill improvement, typed mock interviews, applicant management, and AI recruiter assistance in plain language.</p>
          </div>
          <div className="trust-line"><ShieldCheck size={20} /> Protected and sensitive traits are excluded from ranking.</div>
        </section>
        <section className="auth-form-wrap">
          <div className="auth-form demo-access">
            <span className="demo-badge">UPDATED ROLE-SCOPED BUILD · ISOLATED SAMPLE DATA</span>
            <Sparkles size={24} />
            <h2>Choose your account perspective</h2>
            <p>Select the role you would choose during signup. The review session will show only that role's dashboard, navigation, analytics, and permitted workflows.</p>
            <div className="demo-role-list">
              <button type="button" className={role === "candidate" ? "selected" : ""} aria-pressed={role === "candidate"} onClick={() => setRole("candidate")}>
                <UserRoundSearch size={22} />
                <span><strong>Job seeker</strong><small>Recommendations, resume evidence, assessments and mock interviews</small></span>
              </button>
              <button type="button" className={role === "recruiter" ? "selected" : ""} aria-pressed={role === "recruiter"} onClick={() => setRole("recruiter")}>
                <BriefcaseBusiness size={22} />
                <span><strong>Recruiter</strong><small>Evidence review, explainable ranking and human-confirmed stage changes</small></span>
              </button>
              <button type="button" className={role === "admin" ? "selected" : ""} aria-pressed={role === "admin"} onClick={() => setRole("admin")}>
                <ShieldCheck size={22} />
                <span><strong>Platform admin</strong><small>Invitation-only in production · governance, identity health and audit metrics</small></span>
              </button>
            </div>
            <div className="role-lock-notice"><LockKeyhole size={18} /><p><strong>One account, one authoritative perspective</strong><small>Cross-role pages are blocked even when their URL is entered manually.</small></p></div>
            <button className="primary wide demo-enter-button" type="button" onClick={() => openDemo(role)}>
              {role === "candidate" ? "Enter Job Seeker workspace" : role === "recruiter" ? "Enter Recruiter workspace" : "Enter invited Admin workspace"}
            </button>
            <div className="demo-auth-architecture">
              <div><span className="eyebrow">PRODUCTION IDENTITY PATH</span><strong>Both authentication methods are implemented</strong></div>
              <section><KeyRound /><p><strong>Email + JWT</strong><small>Short-lived access token</small></p><RefreshCw /><p><strong>Rotating refresh</strong><small>HttpOnly server cookie</small></p></section>
              <section><span className="google-g">G</span><p><strong>Google Identity</strong><small>ID token verified by the API</small></p><Fingerprint /><p><strong>One RBAC account</strong><small>Candidate or recruiter only</small></p></section>
            </div>
            <p className="demo-auth-note">This public review build uses isolated sample sessions. Exit the workspace before choosing another role. Production email/JWT and Google sign-in use the same server-authoritative role; Google cannot create an admin, and admin signup requires a single-use invitation.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="brand"><BrainCircuit size={28} /> <span>QuickHire</span></div>
        <div>
          <span className="eyebrow mint">QUICKHIRE</span>
          <h1>One account for job search and responsible recruiting.</h1>
          <p>Understand why a job matches, improve missing skills, and keep every hiring decision with a person.</p>
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
          {authConfig?.google_enabled && authConfig.google_client_id && (
            <GoogleAuthButton
              clientId={authConfig.google_client_id}
              onCredential={handleGoogleCredential}
              onError={handleGoogleError}
              text={mode === "login" ? "signin_with" : "signup_with"}
            />
          )}
          {googleError && <div className="form-error compact-error" role="alert">{googleError}</div>}
          {authConfig?.google_enabled && <div className="auth-divider"><span>or use email</span></div>}
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
