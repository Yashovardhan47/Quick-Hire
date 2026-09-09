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
  return (
    <article className="fit-card">
      <div className="fit-card-head">
        <div><span className="eyebrow">{company}</span><h3>{role}</h3></div>
        <div className="score" aria-label={`${score} percent evidence fit`}><strong>{score}</strong><span>% fit</span></div>
      </div>
      <div className="confidence"><span style={{ width: `${confidence}%` }} /></div>
      <p className="muted">Evidence confidence {confidence}%{scoreRange ? ` · likely range ${scoreRange[0]}–${scoreRange[1]}` : ""} · Human review required</p>
      {rankingFeatures && <div className="ranking-signals" aria-label="Ranking provenance">
        <div><span>Evidence</span><strong>{Math.round(rankingFeatures.structured_evidence ?? 0)}</strong></div>
        <div><span>Semantic</span><strong>{Math.round(rankingFeatures.semantic_similarity ?? 0)}</strong></div>
        <div><span>Reranker</span><strong>{Math.round(rankingFeatures.cross_feature_reranker ?? 0)}</strong></div>
        <div><span>Citations</span><strong>{citationCount}</strong></div>
      </div>}
      <div className={`confidence-state ${abstained ? "abstained" : ""}`}>{abstained ? "Recommendation withheld: more evidence required" : (confidenceStatus ?? "uncalibrated").replaceAll("_", " ")}</div>
      <div className="evidence-columns">
        <div><h4>Supported</h4>{strengths.map(x => <span className="chip good" key={x}>{x}</span>)}</div>
        <div><h4>Verify next</h4>{gaps.map(x => <span className="chip warn" key={x}>{x}</span>)}</div>
      </div>
      {actions ?? <button className="primary">Open evidence map</button>}
    </article>
  );
}
