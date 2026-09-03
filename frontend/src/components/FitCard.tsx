type FitCardProps = {
  role: string;
  company: string;
  score: number;
  confidence: number;
  strengths: string[];
  gaps: string[];
};

export default function FitCard({ role, company, score, confidence, strengths, gaps }: FitCardProps) {
  return (
    <article className="fit-card">
      <div className="fit-card-head">
        <div><span className="eyebrow">{company}</span><h3>{role}</h3></div>
        <div className="score" aria-label={`${score} percent evidence fit`}><strong>{score}</strong><span>% fit</span></div>
      </div>
      <div className="confidence"><span style={{ width: `${confidence}%` }} /></div>
      <p className="muted">Evidence confidence {confidence}% · Human review required</p>
      <div className="evidence-columns">
        <div><h4>Supported</h4>{strengths.map(x => <span className="chip good" key={x}>{x}</span>)}</div>
        <div><h4>Verify next</h4>{gaps.map(x => <span className="chip warn" key={x}>{x}</span>)}</div>
      </div>
      <button className="primary">Open evidence map</button>
    </article>
  );
}

