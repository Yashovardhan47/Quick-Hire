import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Link2, ShieldCheck } from "lucide-react";
import GoogleIdentityButton from "../components/GoogleIdentityButton";
import { api, getSession } from "../lib/api";

type AuthMethods = {
  email: string;
  password_enabled: boolean;
  google_linked: boolean;
  email_verified: boolean;
};

export default function AccountPage() {
  const [methods, setMethods] = useState<AuthMethods | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const role = getSession()?.user.role;

  const loadMethods = useCallback(() => {
    api<AuthMethods>("/auth/methods").then(setMethods).catch(reason => {
      setError(reason instanceof Error ? reason.message : "Unable to load account methods");
    });
  }, []);

  useEffect(() => { loadMethods(); }, [loadMethods]);

  const linkGoogle = useCallback(async (credential: string) => {
    setError("");
    setMessage("");
    try {
      const result = await api<AuthMethods>("/auth/google/link", {
        method: "POST",
        body: JSON.stringify({ credential }),
      });
      setMethods(result);
      setMessage("Google sign-in is now linked to this QuickHire account.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to link Google");
    }
  }, []);

  return (
    <section className="workspace focused-workspace">
      <div className="section-heading">
        <div><span className="eyebrow">ACCOUNT & SAFETY</span><h2>Sign-in methods and decision protections</h2></div>
        <span className="safe-badge"><ShieldCheck size={15} /> Server enforced</span>
      </div>
      {message && <div className="inline-notice" role="status">{message}</div>}
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="content-grid account-grid">
        <article className="panel">
          <KeyRound size={25} />
          <span className="eyebrow">SIGN-IN METHODS</span>
          <h3>{methods?.email ?? "Loading account…"}</h3>
          <div className="auth-method-row"><span>Password</span><strong>{methods?.password_enabled ? "Enabled" : "Not set"}</strong></div>
          <div className="auth-method-row"><span>Google</span><strong>{methods?.google_linked ? "Linked" : "Not linked"}</strong></div>
          <div className="auth-method-row"><span>Email</span><strong>{methods?.email_verified ? "Verified" : "Not verified"}</strong></div>
          {role !== "admin" && methods && !methods.google_linked && (
            <div className="link-provider">
              <p><Link2 size={16} /> Link the Google account with the same email. QuickHire never links accounts silently.</p>
              <GoogleIdentityButton onCredential={linkGoogle} text="continue_with" />
            </div>
          )}
          {methods?.google_linked && <p className="provider-confirmed"><CheckCircle2 size={17} /> Google sign-in is available for this account.</p>}
        </article>
        <article className="panel">
          <ShieldCheck size={25} />
          <span className="eyebrow">EMPLOYMENT AI BOUNDARY</span>
          <h3>People own every consequential decision</h3>
          <ul className="check-list">
            <li>No autonomous rejection, shortlisting, offer or hiring</li>
            <li>Typed interview answers only, against a disclosed job rubric</li>
            <li>No appearance, voice, accent, emotion, personality, disability or honesty scoring</li>
            <li>Protected and sensitive signals are blocked before ranking</li>
            <li>Every recruiter stage change needs evidence review, confirmation and a reason</li>
          </ul>
        </article>
      </div>
    </section>
  );
}
