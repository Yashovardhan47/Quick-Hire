import { FormEvent, useCallback, useEffect, useState } from "react";
import { CheckCircle2, FileQuestion, KeyRound, Link2, ShieldCheck } from "lucide-react";
import GoogleIdentityButton from "../components/GoogleIdentityButton";
import { api, getSession } from "../lib/api";

type AuthMethods = {
  email: string;
  password_enabled: boolean;
  google_linked: boolean;
  email_verified: boolean;
};

type CandidateRequest = { id: string; request_type: string; details: string; status: string; resolution: string; created_at: string };
type ExternalConsent = { purpose: "external_model_processing"; granted: boolean; policy_version: string; updated_at: string | null };

export default function AccountPage() {
  const [methods, setMethods] = useState<AuthMethods | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [requests, setRequests] = useState<CandidateRequest[]>([]);
  const [externalConsent, setExternalConsent] = useState<ExternalConsent | null>(null);
  const [requestType, setRequestType] = useState("correction");
  const [requestDetails, setRequestDetails] = useState("");
  const role = getSession()?.user.role;

  const loadMethods = useCallback(() => {
    api<AuthMethods>("/auth/methods").then(setMethods).catch(reason => {
      setError(reason instanceof Error ? reason.message : "Unable to load account methods");
    });
  }, []);

  const loadRequests = useCallback(() => {
    if (role === "candidate") {
      api<CandidateRequest[]>("/candidate-requests/me").then(setRequests).catch(() => undefined);
      api<ExternalConsent>("/candidate-consents/me").then(setExternalConsent).catch(() => undefined);
    }
  }, [role]);

  useEffect(() => { loadMethods(); loadRequests(); }, [loadMethods, loadRequests]);

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

  async function requestVerification() {
    try {
      const result = await api<{ message: string }>("/auth/email-verification/request", { method: "POST" });
      setMessage(result.message); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to request verification"); }
  }

  async function submitRequest(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    try {
      await api("/candidate-requests", { method: "POST", body: JSON.stringify({ request_type: requestType, details: requestDetails }) });
      setRequestDetails(""); setMessage("Your request was securely submitted for platform-admin review."); loadRequests();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to submit request"); }
  }

  async function setExternalProcessing(granted: boolean) {
    try {
      setExternalConsent(await api<ExternalConsent>("/candidate-consents/me", { method: "PUT", body: JSON.stringify({ granted }) }));
      setMessage(granted ? "External model processing consent saved. You can revoke it at any time." : "External model processing revoked. Matching now stays inside QuickHire.");
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update consent"); }
  }

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
          {methods && !methods.email_verified && <button className="secondary wide" onClick={() => void requestVerification()}>Send verification email</button>}
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
      {role === "candidate" && externalConsent && <article className="panel consent-panel"><div><ShieldCheck size={25} /><div><span className="eyebrow">OPTIONAL EXTERNAL AI PROCESSING</span><h3>Keep matching local, or explicitly opt in</h3><p>The local EvidenceGraph works without sending your evidence to an external model. If the platform operator enables an approved embedding provider, it can be used only while this consent is active. Revoking consent immediately recalculates active matches locally.</p><small>Consent policy: {externalConsent.policy_version}{externalConsent.updated_at ? ` · updated ${new Date(externalConsent.updated_at).toLocaleString()}` : " · never granted"}</small></div></div><label className="confirmation-check"><input type="checkbox" checked={externalConsent.granted} onChange={event => void setExternalProcessing(event.target.checked)} /> Allow approved external embedding and reranking for my job-related evidence.</label></article>}
      {role === "candidate" && <article className="panel recourse-panel"><div className="subheading"><div><span className="eyebrow">CORRECTION, APPEAL & PRIVACY</span><h3>Request human review or exercise your data rights</h3></div><FileQuestion /></div><p>These requests are restricted to you and platform administrators and are never used as matching or interview features.</p><form onSubmit={submitRequest}><label>Request type<select value={requestType} onChange={event => setRequestType(event.target.value)}><option value="correction">Correct my data</option><option value="appeal">Appeal a recommendation</option><option value="accommodation">Request an accommodation</option><option value="data_export">Export my data</option><option value="deletion">Request deletion</option></select></label><label>Details<textarea value={requestDetails} onChange={event => setRequestDetails(event.target.value)} minLength={10} maxLength={5000} placeholder="Explain what you need. Avoid sharing medical details unless necessary for the request." required /></label><button className="primary">Submit for human review</button></form><div className="request-list">{requests.map(item => <div className="audit-row request-row" key={item.id}><div><strong>{item.request_type.replaceAll("_", " ")}</strong><p>{item.details}</p>{item.resolution && <small>Resolution: {item.resolution}</small>}</div><span className="status">{item.status.replaceAll("_", " ")}</span></div>)}</div></article>}
    </section>
  );
}
