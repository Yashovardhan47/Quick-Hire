const candidates = [
  { name: "Candidate A", score: 84, confidence: 82, evidence: "9 / 10", status: "Review" },
  { name: "Candidate B", score: 79, confidence: 68, evidence: "7 / 10", status: "Verify" },
  { name: "Candidate C", score: 73, confidence: 76, evidence: "8 / 10", status: "Review" },
];

export default function RecruiterDashboard() {
  return (
    <section className="workspace">
      <div className="section-heading">
        <div><span className="eyebrow">RECRUITER</span><h2>Evidence-based candidate review</h2></div>
        <button className="primary">Create competency-based job</button>
      </div>
      <div className="review-banner">
        <div><strong>Data Analyst · 34 applicants</strong><p>Ranking uses job evidence only. Names can be hidden during first review.</p></div>
        <button className="secondary">Enable blind review</button>
      </div>
      <article className="panel table-panel">
        <table>
          <thead><tr><th>Candidate</th><th>Evidence fit</th><th>Confidence</th><th>Requirements supported</th><th>AI next step</th><th /></tr></thead>
          <tbody>{candidates.map(candidate => (
            <tr key={candidate.name}>
              <td><strong>{candidate.name}</strong></td>
              <td>{candidate.score}%</td><td>{candidate.confidence}%</td><td>{candidate.evidence}</td>
              <td><span className={`status ${candidate.status === "Verify" ? "warning" : ""}`}>{candidate.status}</span></td>
              <td><button className="text-button">Evidence map</button></td>
            </tr>
          ))}</tbody>
        </table>
      </article>
    </section>
  );
}

