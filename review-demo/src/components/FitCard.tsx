import type { ReactNode } from "react";

type FitCardProps = {
  role: string;
  company: string;
  score: number;
  confidence: number;
  strengths: string[];
  gaps: string[];
  actions?: ReactNode;
  scoreRange?: [number, number];
  confidenceStatus?: string;
  rankingFeatures?: Record<string, number>;
  citationCount?: number;
  abstained?: boolean;
};

export default function FitCard({ role, company, score, confidence, strengths, gaps, actions, scoreRange, confidenceStatus, rankingFeatures, citationCount = 0, abstained = false }: FitCardProps) {
  const reliability = abstained ? "More supporting proof needed" : confidence >= 80 ? "Strong supporting proof" : confidence >= 65 ? "Moderate supporting proof" : "Limited supporting proof";
  return (
    <article className="fit-card">
      <div className="fit-card-head">
        <div><span className="eyebrow">{company}</span><h3>{role}</h3></div>
        <div className="score" aria-label={`${score} percent evidence fit`}><strong>{score}</strong><span>% fit</span></div>
      </div>
      <div className="confidence"><span style={{ width: `${confidence}%` }} /></div>
      <p className="muted">Match reliability {confidence}%{scoreRange ? ` · estimated range ${scoreRange[0]}–${scoreRange[1]}` : ""} · Recruiter review required</p>
      {rankingFeatures && <div className="ranking-signals" aria-label="Why this job matches">
        <div><span>Supporting proof</span><strong>{Math.round(rankingFeatures.structured_evidence ?? 0)}</strong></div>
        <div><span>Job relevance</span><strong>{Math.round(rankingFeatures.semantic_similarity ?? 0)}</strong></div>
        <div><span>Overall review</span><strong>{Math.round(rankingFeatures.cross_feature_reranker ?? 0)}</strong></div>
        <div><span>Proof sources</span><strong>{citationCount}</strong></div>
      </div>}
      <div className={`confidence-state ${abstained ? "abstained" : ""}`} title={confidenceStatus?.replaceAll("_", " ")}>{reliability}</div>
      <div className="evidence-columns">
        <div><h4>What already matches</h4>{strengths.map(x => <span className="chip good" key={x}>{x}</span>)}</div>
        <div><h4>What to improve or prove</h4>{gaps.map(x => <span className="chip warn" key={x}>{x}</span>)}</div>
      </div>
      {actions ?? <button className="primary">See why you match</button>}
    </article>
  );
}
