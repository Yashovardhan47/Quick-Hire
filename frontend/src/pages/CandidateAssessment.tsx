import { FormEvent, useState } from "react";
import { ArrowLeft, CheckCircle2, ClipboardCheck } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";

type Question = {
  id: string;
  competency: string;
  prompt: string;
  options: string[];
  difficulty: string;
  manual_review: boolean;
};
type Attempt = { id: string; job_id: string; status: string; questions: Question[]; model_version: string };
type Result = { score: number; competency_scores: Record<string, number>; feedback: string[] };

export default function CandidateAssessment() {
  const { jobId } = useParams();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function start() {
    if (!jobId) return;
    setWorking(true);
    setError("");
    try {
      setAttempt(await api<Attempt>(`/assessments/adaptive/${jobId}`, { method: "POST" }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create assessment");
    } finally {
      setWorking(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!attempt) return;
    setWorking(true);
    setError("");
    try {
      setResult(await api<Result>(`/assessments/${attempt.id}/submit`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to score assessment");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="workspace focused-workspace">
      <Link className="back-link" to="/candidate"><ArrowLeft size={17} /> Back to recommendations</Link>
      <div className="section-heading">
        <div><span className="eyebrow">ADAPTIVE VERIFICATION</span><h2>Target the evidence that is missing</h2></div>
        {attempt && <span className="safe-badge">{attempt.model_version}</span>}
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {!attempt && (
        <article className="panel start-panel">
          <ClipboardCheck size={34} />
          <h3>A short, job-specific evidence check</h3>
          <p>Questions are selected from the job requirements with the weakest evidence. Objective answers can create verified skill signals; unsupported competencies go to human review.</p>
          <button className="primary" onClick={() => void start()} disabled={working}>{working ? "Preparing…" : "Start targeted check"}</button>
        </article>
      )}
      {attempt && !result && (
        <form className="assessment-form" onSubmit={submit}>
          {attempt.questions.map((question, index) => (
            <fieldset className="panel question-card" key={question.id}>
              <legend><span>{index + 1}</span> {question.competency}</legend>
              <p>{question.prompt}</p>
              {question.options.length > 0 ? question.options.map(option => (
                <label className="answer-option" key={option}>
                  <input type="radio" name={question.id} value={option} checked={answers[question.id] === option} onChange={() => setAnswers({ ...answers, [question.id]: option })} required />
                  <span>{option}</span>
                </label>
              )) : (
                <textarea aria-label={`Answer for ${question.competency}`} value={answers[question.id] ?? ""} onChange={event => setAnswers({ ...answers, [question.id]: event.target.value })} minLength={30} required />
              )}
              {question.manual_review && <small>Saved for human review and excluded from the automated score.</small>}
            </fieldset>
          ))}
          <button className="primary submit-work" disabled={working}>{working ? "Scoring…" : "Submit evidence check"}</button>
        </form>
      )}
      {result && (
        <article className="panel result-panel">
          <CheckCircle2 size={36} />
          <span className="eyebrow">COMPLETED</span>
          <h2>{result.score}% objective score</h2>
          <div className="score-list">{Object.entries(result.competency_scores).map(([skill, score]) => <div key={skill}><span>{skill}</span><strong>{Math.round(score * 100)}%</strong></div>)}</div>
          {result.feedback.map(item => <p key={item}>{item}</p>)}
          <Link className="primary link-button" to="/candidate">Recalculate recommendations</Link>
        </article>
      )}
    </section>
  );
}
