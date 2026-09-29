import { ArrowRight, BriefcaseBusiness, CheckCircle2, Search, ShieldCheck, Sparkles, UserRoundSearch, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { UserRole } from "../lib/api";

const tours = {
  candidate: [
    { title: "Find jobs", body: "Search QuickHire roles or switch to verified live external listings.", path: "/jobs", icon: Search },
    { title: "See why you match", body: "Understand supported requirements, missing skills, and match reliability in plain language.", path: "/candidate#why-match", icon: UserRoundSearch },
    { title: "Improve and track", body: "Follow your skill plan, complete checks, message recruiters, and track every application.", path: "/candidate/applications", icon: CheckCircle2 },
  ],
  recruiter: [
    { title: "Create a clear job", body: "Turn the job description into a reviewable skills and requirements checklist.", path: "/recruiter#job-builder", icon: BriefcaseBusiness },
    { title: "Review every applicant", body: "Compare job-related proof and record each stage change as your own human decision.", path: "/recruiter", icon: UserRoundSearch },
    { title: "Use the AI assistant", body: "Summarize the queue, prepare evidence requests, and draft structured interview plans.", path: "/recruiter/assistant", icon: Sparkles },
  ],
  admin: [
    { title: "Monitor platform health", body: "Review authentication, activity, model quality, and workflow signals.", path: "/admin", icon: ShieldCheck },
    { title: "Enforce the decision boundary", body: "AI remains advisory and every consequential stage change belongs to a person.", path: "/admin", icon: CheckCircle2 },
    { title: "Audit sensitive-signal controls", body: "Interview and matching workflows exclude biometric, protected, and sensitive traits.", path: "/admin", icon: ShieldCheck },
  ],
} satisfies Record<UserRole, { title: string; body: string; path: string; icon: typeof Search }[]>;

export default function OnboardingTour({ role }: { role: UserRole }) {
  const navigate = useNavigate();
  const storageKey = `quickhire.review.onboarding.${role}`;
  const [open, setOpen] = useState(() => sessionStorage.getItem(storageKey) !== "done");
  const [step, setStep] = useState(0);
  const items = tours[role];
  const current = items[step];
  const Icon = current.icon;

  useEffect(() => {
    setStep(0);
    setOpen(sessionStorage.getItem(storageKey) !== "done");
  }, [storageKey]);

  function finish(path?: string) {
    sessionStorage.setItem(storageKey, "done");
    setOpen(false);
    if (path) navigate(path);
  }

  if (!open) return null;

  return (
    <div className="tour-backdrop" role="presentation">
      <section className="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title">
        <button className="tour-close" type="button" aria-label="Skip introduction" onClick={() => finish()}><X /></button>
        <div className="tour-progress">{items.map((_, index) => <span className={index <= step ? "active" : ""} key={index} />)}</div>
        <div className="tour-icon"><Icon /></div>
        <span className="eyebrow">STEP {step + 1} OF {items.length}</span>
        <h2 id="tour-title">{current.title}</h2>
        <p>{current.body}</p>
        <div className="tour-actions">
          <button type="button" className="text-button" onClick={() => finish()}>Skip introduction</button>
          {step < items.length - 1
            ? <button type="button" className="primary" onClick={() => setStep(step + 1)}>Next <ArrowRight size={17} /></button>
            : <button type="button" className="primary" onClick={() => finish(current.path)}>Start here <ArrowRight size={17} /></button>}
        </div>
      </section>
    </div>
  );
}
