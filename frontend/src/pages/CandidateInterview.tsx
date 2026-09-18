import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, Mic, MessageSquareText, ShieldCheck, Square, Volume2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";

type Citation = { requirement: string; source_uri: string; excerpt: string; verified: boolean };
type Question = { id: string; competency: string; prompt: string; evaluation_criteria: string[]; evidence_citations: Citation[] };
type Session = { id: string; job_id: string; status: string; questions: Question[]; notice: string; model_version: string };
type Result = { content_score: number; rubric_scores: Record<string, number>; feedback: string[]; human_review_required: boolean; evaluation_mode: string; evidence_citations: Citation[]; agent_trace: { agent: string; status: string; detail: string }[] };
type Capabilities = { voice_transcription_configured: boolean; voice_evaluation_enabled: boolean };
type Transcript = { transcript: string; retained_audio: false; evaluation_basis: "answer_text_only"; model_version: string; notice: string };

export default function CandidateInterview() {
  const { jobId } = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [recordingQuestion, setRecordingQuestion] = useState("");
  const [voiceNotice, setVoiceNotice] = useState("");
  const [capabilities, setCapabilities] = useState<Capabilities>({ voice_transcription_configured: false, voice_evaluation_enabled: false });
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    api<Capabilities>("/capabilities").then(setCapabilities).catch(() => undefined);
    return () => {
      recorderRef.current?.stream.getTracks().forEach(track => track.stop());
      window.speechSynthesis?.cancel();
    };
  }, []);

  function speakQuestion(text: string) {
    if (!("speechSynthesis" in window)) { setVoiceNotice("Text-to-speech is unavailable in this browser."); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
    setVoiceNotice("Reading the question aloud. No voice information is sent to QuickHire.");
  }

  async function startRecording(questionId: string) {
    if (!capabilities.voice_transcription_configured) {
      setVoiceNotice("Voice transcription is optional and has not been configured by this deployment. You can always type your answer.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
      setVoiceNotice("Audio recording is unavailable in this browser. Type your answer instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const preferredType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined);
      recorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size) audioChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const mediaType = recorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: mediaType });
        stream.getTracks().forEach(track => track.stop());
        const form = new FormData();
        form.append("file", new File([blob], `answer-${questionId}.webm`, { type: mediaType }));
        setWorking(true);
        api<Transcript>("/voice/transcribe", { method: "POST", body: form })
          .then(result => {
            setAnswers(current => ({ ...current, [questionId]: [current[questionId], result.transcript].filter(Boolean).join(" ") }));
            setVoiceNotice(result.notice);
          })
          .catch(reason => setVoiceNotice(reason instanceof Error ? reason.message : "Unable to transcribe recording"))
          .finally(() => setWorking(false));
      };
      recorder.start(500);
      setRecordingQuestion(questionId);
      setVoiceNotice("Recording for transcription only. Stop when finished; the audio will not be retained or scored.");
    } catch {
      setVoiceNotice("Microphone access was not available. You can continue by typing your answer.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecordingQuestion("");
  }

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
          <p>Your editable answer text is checked for context, action, result and reflection. QuickHire never analyzes your appearance, voice, accent, emotion, disability, personality or honesty.</p>
          <button className="primary" onClick={() => void start()} disabled={working}>{working ? "Preparing…" : "Start mock interview"}</button>
        </article>
      )}
      {session && !result && (
        <form className="assessment-form" onSubmit={submit}>
          <div className="inline-notice"><ShieldCheck size={18} /> {session.notice}</div>
          {voiceNotice && <div className="inline-notice" role="status">{voiceNotice}</div>}
          {session.questions.map((question, index) => (
            <article className="panel question-card" key={question.id}>
              <span className="question-number">{index + 1}</span><span className="eyebrow">{question.competency}</span>
              <h3>{question.prompt}</h3>
              <p className="muted">Evaluation: {question.evaluation_criteria.join(" · ")}</p>
              <div className="button-row voice-tools">
                <button type="button" className="secondary" onClick={() => speakQuestion(question.prompt)}><Volume2 size={16} /> Listen</button>
                {recordingQuestion === question.id
                  ? <button type="button" className="secondary danger" onClick={stopRecording}><Square size={16} /> Stop recording</button>
                  : <button type="button" className="secondary" disabled={working || Boolean(recordingQuestion)} onClick={() => void startRecording(question.id)}><Mic size={16} /> Speak to editable text</button>}
              </div>
              <textarea aria-label={`Interview answer for ${question.competency}`} value={answers[question.id] ?? ""} onChange={event => setAnswers({ ...answers, [question.id]: event.target.value })} minLength={40} placeholder="Use a specific example and measurable result…" required />
              {question.evidence_citations?.length > 0 && <details className="grounding-details"><summary>Why this question was selected</summary>{question.evidence_citations.map(citation => <p key={citation.source_uri}><strong>{citation.requirement}</strong>: {citation.excerpt} <small>{citation.source_uri}</small></p>)}</details>}
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
          <p className="muted">Evaluation path: {result.evaluation_mode.replaceAll("_", " ")}. The evaluator received answer text only.</p>
          <div className="score-list">{Object.entries(result.rubric_scores).map(([skill, score]) => <div key={skill}><span>{skill}</span><strong>{Math.round(score)}%</strong></div>)}</div>
          {result.feedback.map(item => <p key={item}>{item}</p>)}
          {result.agent_trace?.length > 0 && <details className="grounding-details"><summary>Auditable AI workflow</summary>{result.agent_trace.map((step, index) => <p key={`${step.agent}-${index}`}><strong>{step.agent.replaceAll("_", " ")}</strong>: {step.detail}</p>)}</details>}
          <Link className="primary link-button" to="/candidate">Return to evidence map</Link>
        </article>
      )}
    </section>
  );
}
