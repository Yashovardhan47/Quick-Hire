import { Activity, Scale, ShieldAlert, Waypoints } from "lucide-react";

export default function AdminDashboard() {
  return (
    <section className="workspace">
      <div className="section-heading">
        <div><span className="eyebrow">PLATFORM ADMIN</span><h2>Trust, model quality and workflow health</h2></div>
        <button className="secondary">Export audit report</button>
      </div>
      <div className="metric-grid">
        <article><Activity /><strong>99.9%</strong><span>API availability</span></article>
        <article><Waypoints /><strong>0.91</strong><span>Ranking NDCG@10</span></article>
        <article><Scale /><strong>Review</strong><span>Fairness audit state</span></article>
        <article><ShieldAlert /><strong>4</strong><span>Moderation flags</span></article>
      </div>
      <div className="content-grid">
        <article className="panel"><span className="eyebrow">MODEL REGISTRY</span><h3>EvidenceGraph baseline 0.1.0</h3><p>Deterministic evidence scoring · human review enforced · protected features excluded.</p><div className="audit-row"><span>Calibration check</span><strong>Pending dataset</strong></div><div className="audit-row"><span>Explanation fidelity</span><strong>Passing</strong></div></article>
        <article className="panel"><span className="eyebrow">REQUIRED CONTROLS</span><h3>Before production use</h3><ul className="check-list"><li>Independent bias evaluation</li><li>Candidate notice and accommodation path</li><li>Data retention and deletion workflow</li><li>Human override and appeal audit</li></ul></article>
      </div>
    </section>
  );
}

