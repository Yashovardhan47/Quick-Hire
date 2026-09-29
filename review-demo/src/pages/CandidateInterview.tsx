import { FormEvent, useState } from "react";
import { ArrowLeft, MessageSquareText, ShieldCheck } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";

type Question = { id: string; competency: string; prompt: string; evaluation_criteria: string[] };
type Session = { id: string; job_id: string; status: string; questions: Question[]; notice: string; model_version: string; input_modality: "typed_text"; policy_version: string };
type Result = { content_score: number; rubric_scores: Record<string, number>; feedback: string[]; human_review_required: boolean; input_modality: "typed_text"; excluded_signal_categories: string[]; policy_version: string };

export default function CandidateInterview() {
  const { jobId } = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function start() {
    if (!jobId) return;
    setWorking(true);
    try {
      setSession(await api<Session>(`/interviews/mock/${jobId}`, { method: "POST" }));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to prepare interview");
    } finally {
      setWorking(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    setWorking(true);
    try {
      setResult(await api<Result>(`/interviews/${session.id}/submit`, { method: "POST", body: JSON.stringify({ answers }) }));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to score interview");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="workspace focused-workspace">
      <Link className="back-link" to="/candidate"><ArrowLeft size={17} /> Back to recommendations</Link>
      <div className="section-heading"><div><span className="eyebrow">STRUCTURED MOCK INTERVIEW</span><h2>Practice against a disclosed rubric</h2></div></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {!session && (
        <article className="panel start-panel">
          <MessageSquareText size={34} />
          <h3>Job-related practice without biometric scoring</h3>
          <p>Your typed answers are checked for context, action, result and reflection. QuickHire never analyzes your appearance, voice, accent, emotion, disability, personality or honesty.</p>
          <button className="primary" onClick={() => void start()} disabled={working}>{working ? "Preparing…" : "Start mock interview"}</button>
        </article>
      )}
      {session && !result && (
        <form className="assessment-form" onSubmit={submit}>
          <div className="inline-notice"><ShieldCheck size={18} /> {session.notice}</div>
          <div className="policy-badges"><span>Typed text only</span><span>Advisory feedback</span><span>{session.policy_version}</span></div>
          {session.questions.map((question, index) => (
            <article className="panel question-card" key={question.id}>
              <span className="question-number">{index + 1}</span><span className="eyebrow">{question.competency}</span>
              <h3>{question.prompt}</h3>
              <p className="muted">Evaluation: {question.evaluation_criteria.join(" · ")}</p>
              <textarea aria-label={`Interview answer for ${question.competency}`} value={answers[question.id] ?? ""} onChange={event => setAnswers({ ...answers, [question.id]: event.target.value })} minLength={40} placeholder="Use a specific example and measurable result…" required />
            </article>
          ))}
          <button className="primary submit-work" disabled={working}>{working ? "Reviewing…" : "Get content feedback"}</button>
        </form>
      )}
      {result && (
        <article className="panel result-panel">
          <ShieldCheck size={36} />
          <span className="eyebrow">CONTENT FEEDBACK</span>
          <h2>{result.content_score}% rubric coverage</h2>
          <p>This is practice feedback, not an eligibility or hiring decision. A person must verify every claim and interpret context.</p>
          <div className="policy-badges"><span>Human review required</span><span>{result.excluded_signal_categories.length} signal categories excluded</span></div>
          <div className="score-list">{Object.entries(result.rubric_scores).map(([skill, score]) => <div key={skill}><span>{skill}</span><strong>{Math.round(score)}%</strong></div>)}</div>
          {result.feedback.map(item => <p key={item}>{item}</p>)}
          <Link className="primary link-button" to="/candidate">Return to job matches</Link>
        </article>
      )}
    </section>
  );
}
