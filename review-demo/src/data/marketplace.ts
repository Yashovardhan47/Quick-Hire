export type MarketplaceJob = {
  id: string;
  title: string;
  company: string;
  companyMark: string;
  location: string;
  workMode: "Remote" | "Hybrid" | "On-site";
  type: "Full-time" | "Internship" | "Contract";
  category: string;
  salary: string;
  skills: string[];
  posted: string;
  applicants: number;
  fit: number;
  confidence: number;
  summary: string;
  verified: boolean;
  live?: boolean;
  source?: string;
  externalUrl?: string;
};

export const marketplaceJobs: MarketplaceJob[] = [
  { id: "job-ai-01", title: "Applied AI Engineer", company: "Aster Labs", companyMark: "AL", location: "Bengaluru", workMode: "Hybrid", type: "Full-time", category: "AI & Data", salary: "₹18–26 LPA", skills: ["Python", "FastAPI", "Machine learning", "MLOps"], posted: "2 hours ago", applicants: 12, fit: 88, confidence: 84, summary: "Build explainable AI services, evaluation pipelines, and dependable model-backed product experiences.", verified: true },
  { id: "job-ds-02", title: "Product Data Scientist", company: "Northstar Commerce", companyMark: "NC", location: "India", workMode: "Remote", type: "Full-time", category: "AI & Data", salary: "₹16–24 LPA", skills: ["Python", "SQL", "Experiment design", "Statistics"], posted: "4 hours ago", applicants: 38, fit: 81, confidence: 76, summary: "Turn product behavior into experiments, causal insight, and measurable growth decisions.", verified: true },
  { id: "job-ml-03", title: "Machine Learning Intern", company: "Kite Intelligence", companyMark: "KI", location: "Hyderabad", workMode: "Hybrid", type: "Internship", category: "AI & Data", salary: "₹35k–55k / month", skills: ["Python", "scikit-learn", "NLP", "Evaluation"], posted: "Today", applicants: 74, fit: 86, confidence: 79, summary: "Prototype language and ranking systems with reproducible offline evaluation.", verified: true },
  { id: "job-backend-04", title: "Python Backend Developer", company: "OrbitStack", companyMark: "OS", location: "Pune", workMode: "Remote", type: "Full-time", category: "Engineering", salary: "₹12–18 LPA", skills: ["Python", "FastAPI", "PostgreSQL", "Docker"], posted: "Today", applicants: 26, fit: 84, confidence: 82, summary: "Own secure APIs, database workflows, and event-driven backend services.", verified: true },
  { id: "job-fullstack-05", title: "Full-stack Engineer", company: "Mosaic Works", companyMark: "MW", location: "Chennai", workMode: "Hybrid", type: "Full-time", category: "Engineering", salary: "₹14–22 LPA", skills: ["React", "TypeScript", "Python", "REST APIs"], posted: "1 day ago", applicants: 31, fit: 76, confidence: 72, summary: "Build end-to-end workflow products with accessible interfaces and reliable APIs.", verified: true },
  { id: "job-cloud-06", title: "Cloud Platform Associate", company: "NimbusGrid", companyMark: "NG", location: "Bengaluru", workMode: "On-site", type: "Full-time", category: "Engineering", salary: "₹10–15 LPA", skills: ["AWS", "Linux", "Docker", "CI/CD"], posted: "1 day ago", applicants: 19, fit: 68, confidence: 61, summary: "Support cloud automation, observability, deployment reliability, and incident learning.", verified: true },
  { id: "job-analyst-07", title: "Business Data Analyst", company: "BrightLedger", companyMark: "BL", location: "Mumbai", workMode: "Hybrid", type: "Full-time", category: "Business & Finance", salary: "₹9–14 LPA", skills: ["SQL", "Power BI", "Excel", "Storytelling"], posted: "2 days ago", applicants: 45, fit: 83, confidence: 80, summary: "Build trusted metrics and translate analysis into decision-ready business narratives.", verified: true },
  { id: "job-risk-08", title: "FinTech Risk Analyst", company: "Meridian Pay", companyMark: "MP", location: "Gurugram", workMode: "Hybrid", type: "Full-time", category: "Business & Finance", salary: "₹11–17 LPA", skills: ["Python", "SQL", "Risk modeling", "Analytics"], posted: "2 days ago", applicants: 29, fit: 71, confidence: 67, summary: "Detect risk patterns and build auditable decision-support analytics for payment operations.", verified: true },
  { id: "job-product-09", title: "Associate Product Manager", company: "FlowPilot", companyMark: "FP", location: "India", workMode: "Remote", type: "Full-time", category: "Product & Design", salary: "₹13–19 LPA", skills: ["Product analytics", "Research", "Roadmaps", "Communication"], posted: "3 days ago", applicants: 62, fit: 64, confidence: 59, summary: "Shape product outcomes through research, prioritization, instrumentation, and clear execution.", verified: true },
  { id: "job-ux-10", title: "UX Research Intern", company: "Prism Design Co.", companyMark: "PD", location: "Delhi", workMode: "Remote", type: "Internship", category: "Product & Design", salary: "₹25k–40k / month", skills: ["User research", "Usability", "Synthesis", "Figma"], posted: "3 days ago", applicants: 51, fit: 58, confidence: 55, summary: "Plan studies and turn user evidence into practical interface improvements.", verified: true },
  { id: "job-health-11", title: "Healthcare Data Analyst", company: "CuraMetrics", companyMark: "CM", location: "Hyderabad", workMode: "On-site", type: "Full-time", category: "Healthcare", salary: "₹10–16 LPA", skills: ["SQL", "Python", "Data quality", "Healthcare analytics"], posted: "4 days ago", applicants: 22, fit: 77, confidence: 71, summary: "Improve care operations through privacy-aware reporting and data-quality analysis.", verified: true },
  { id: "job-clinical-12", title: "Clinical Operations Coordinator", company: "Helix Care", companyMark: "HC", location: "Chennai", workMode: "Hybrid", type: "Full-time", category: "Healthcare", salary: "₹7–11 LPA", skills: ["Operations", "Documentation", "Compliance", "Coordination"], posted: "4 days ago", applicants: 17, fit: 49, confidence: 43, summary: "Coordinate documented clinical workflows, timelines, and cross-team operational quality.", verified: true },
  { id: "job-edtech-13", title: "Learning Analytics Specialist", company: "ScholarLoop", companyMark: "SL", location: "India", workMode: "Remote", type: "Full-time", category: "Education", salary: "₹9–15 LPA", skills: ["Python", "Learning analytics", "Dashboards", "Research"], posted: "5 days ago", applicants: 24, fit: 74, confidence: 69, summary: "Use learner evidence to improve content pathways and educational outcomes.", verified: true },
  { id: "job-content-14", title: "Technical Curriculum Intern", company: "CodeSpring", companyMark: "CS", location: "Bengaluru", workMode: "Hybrid", type: "Internship", category: "Education", salary: "₹22k–35k / month", skills: ["Python", "Technical writing", "Teaching", "Assessment design"], posted: "5 days ago", applicants: 41, fit: 79, confidence: 73, summary: "Create practical Python and data learning experiences backed by clear assessments.", verified: true },
  { id: "job-growth-15", title: "Growth Operations Associate", company: "LaunchDeck", companyMark: "LD", location: "Pune", workMode: "Hybrid", type: "Full-time", category: "Operations", salary: "₹8–13 LPA", skills: ["Analytics", "Operations", "CRM", "Experimentation"], posted: "6 days ago", applicants: 33, fit: 62, confidence: 58, summary: "Build repeatable growth operations and measure the experiments that improve them.", verified: true },
  { id: "job-supply-16", title: "Supply Chain Analyst", company: "RouteLine", companyMark: "RL", location: "Mumbai", workMode: "On-site", type: "Full-time", category: "Operations", salary: "₹8–12 LPA", skills: ["Excel", "SQL", "Forecasting", "Optimization"], posted: "6 days ago", applicants: 21, fit: 57, confidence: 52, summary: "Improve demand planning, inventory visibility, and fulfillment performance.", verified: true },
  { id: "job-security-17", title: "Cybersecurity Analyst", company: "Sentinel Forge", companyMark: "SF", location: "Noida", workMode: "On-site", type: "Full-time", category: "Security", salary: "₹11–17 LPA", skills: ["SIEM", "Networking", "Incident response", "Python"], posted: "1 week ago", applicants: 36, fit: 53, confidence: 49, summary: "Investigate security events and improve practical detection and response playbooks.", verified: true },
  { id: "job-research-18", title: "Responsible AI Research Assistant", company: "Verity Institute", companyMark: "VI", location: "India", workMode: "Remote", type: "Contract", category: "Research", salary: "₹60k–90k / month", skills: ["Model evaluation", "Fairness", "Python", "Research writing"], posted: "1 week ago", applicants: 28, fit: 85, confidence: 78, summary: "Evaluate model reliability and document responsible deployment boundaries.", verified: true },
];

export const marketplaceCategories = ["All", ...Array.from(new Set(marketplaceJobs.map(job => job.category)))];
