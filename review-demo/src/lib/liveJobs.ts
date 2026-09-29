import type { MarketplaceJob } from "../data/marketplace";

type ArbeitnowJob = {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  url: string;
  tags: string[];
  job_types: string[];
  location: string;
  created_at: number;
};

type ArbeitnowResponse = { data: ArbeitnowJob[] };

const API_URL = "https://www.arbeitnow.com/api/job-board-api";

function textFromHtml(value: string) {
  const document = new DOMParser().parseFromString(value, "text/html");
  return (document.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

function postedLabel(timestamp: number) {
  const hours = Math.max(0, Math.floor((Date.now() - timestamp * 1000) / 3_600_000));
  if (hours < 1) return "Just posted";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function jobType(value: string | undefined): MarketplaceJob["type"] {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.includes("intern")) return "Internship";
  if (normalized.includes("contract") || normalized.includes("freelance")) return "Contract";
  return "Full-time";
}

export async function fetchLiveJobs(): Promise<MarketplaceJob[]> {
  const response = await fetch(API_URL, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("The live job provider is temporarily unavailable.");
  const payload = await response.json() as ArbeitnowResponse;
  return payload.data.slice(0, 40).map(job => {
    const summary = textFromHtml(job.description).slice(0, 320);
    const companyMark = job.company_name.split(/\s+/).filter(Boolean).map(part => part[0]).join("").slice(0, 2).toUpperCase() || "JOB";
    return {
      id: `live-${job.slug}`,
      title: job.title,
      company: job.company_name,
      companyMark,
      location: job.location || (job.remote ? "Remote" : "Location on listing"),
      workMode: job.remote ? "Remote" : "On-site",
      type: jobType(job.job_types[0]),
      category: job.tags[0] || "Other",
      salary: "See employer listing",
      skills: job.tags.length ? job.tags.slice(0, 5) : job.job_types.slice(0, 3),
      posted: postedLabel(job.created_at),
      applicants: 0,
      fit: 0,
      confidence: 0,
      summary: summary || "Open the source listing to review the complete responsibilities and requirements.",
      verified: false,
      live: true,
      source: "Arbeitnow",
      externalUrl: job.url,
    };
  });
}
