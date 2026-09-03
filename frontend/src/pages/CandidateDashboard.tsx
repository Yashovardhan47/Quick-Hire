import { ArrowUpRight, FileCheck2, MessagesSquare, Target } from "lucide-react";
import FitCard from "../components/FitCard";

export default function CandidateDashboard() {
  return (
    <section className="workspace">
      <div className="section-heading">
        <div><span className="eyebrow">JOB SEEKER</span><h2>Your evidence, opportunities and next move</h2></div>
        <button className="primary">Add verified evidence</button>
      </div>
      <div className="metric-grid">
        <article><Target /><strong>82%</strong><span>Profile evidence coverage</span></article>
        <article><FileCheck2 /><strong>12</strong><span>Verified skill signals</span></article>
        <article><MessagesSquare /><strong>3</strong><span>Applications in review</span></article>
      </div>
      <div className="content-grid">
        <FitCard role="Data Analyst" company="Example Analytics" score={78} confidence={74} strengths={["Python", "SQL", "Power BI"]} gaps={["A/B testing", "Statistics project"]} />
        <article className="panel next-action">
          <span className="eyebrow">COUNTERFACTUAL PLAN</span>
          <h3>One action can strengthen two applications</h3>
          <p>Complete a 20-minute statistics verification. It provides missing evidence for experimentation and analytical reasoning.</p>
          <div className="impact"><ArrowUpRight /> Estimated evidence gain <strong>+9 points</strong></div>
          <button className="secondary">Start targeted check</button>
        </article>
      </div>
    </section>
  );
}

