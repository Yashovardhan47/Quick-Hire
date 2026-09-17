import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, KeyRound } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { api, refreshSession } from "../lib/api";

export default function AuthActionPage({ action }: { action: "verify" | "reset" }) {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState(action === "verify" ? "Verifying your email…" : "");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (action !== "verify") return;
    if (!token) { setStatus("This verification link is missing its token."); return; }
    api<{ message: string }>("/auth/email-verification/confirm", { method: "POST", body: JSON.stringify({ token }) })
      .then(async result => { setStatus(result.message); setComplete(true); await refreshSession(); })
      .catch(reason => setStatus(reason instanceof Error ? reason.message : "Unable to verify email"));
  }, [action, token]);

  async function reset(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) { setStatus("Passwords do not match."); return; }
    try {
      const result = await api<{ message: string }>("/auth/password/reset", { method: "POST", body: JSON.stringify({ token, new_password: password }) });
      setStatus(result.message); setComplete(true);
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Unable to reset password"); }
  }

  return <main className="auth-action-page"><section className="panel auth-action-card">{complete ? <CheckCircle2 size={34} /> : <KeyRound size={34} />}<span className="eyebrow">ACCOUNT SECURITY</span><h1>{action === "verify" ? "Email verification" : "Reset password"}</h1>{action === "reset" && !complete && <form onSubmit={reset}><label>New password<input type="password" minLength={10} value={password} onChange={event => setPassword(event.target.value)} required /></label><label>Confirm password<input type="password" minLength={10} value={confirm} onChange={event => setConfirm(event.target.value)} required /></label><button className="primary">Change password</button></form>}{status && <div className={complete ? "inline-notice" : "form-error"} role="status">{status}</div>}<Link className="text-link" to="/login">Return to sign in</Link></section></main>;
}
