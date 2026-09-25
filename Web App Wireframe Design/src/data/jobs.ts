import { supabase } from "../lib/supabase";
import { functionErrorMessage } from "./resume";

/** One Adzuna listing, as normalized by the "jobs" Edge Function. */
export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  /** A truncated snippet, not the full ad. The full ad is behind `url`. */
  description: string;
  url: string;
  salaryMin: number | null;
  salaryMax: number | null;
  /** True when Adzuna estimated the salary rather than the employer stating it. */
  salaryPredicted: boolean;
  created: string;
  contractTime: string;
  category: string;
}

export interface JobRecommendation extends JobListing {
  score: number;
  reason: string;
  matchedSkills: string[];
}

export interface Recommendations {
  jobs: JobRecommendation[];
  searches: { what: string; where: string }[];
  generatedAt: string;
}

export type JobSort = "relevance" | "date";

export interface JobSearch {
  what: string;
  where: string;
  sort: JobSort;
}

function toRecommendations(row: { jobs: unknown; searches: unknown; generated_at: string }): Recommendations {
  // jsonb columns arrive as Json and need narrowing.
  return {
    jobs: (row.jobs as JobRecommendation[]) ?? [],
    searches: (row.searches as Recommendations["searches"]) ?? [],
    generatedAt: row.generated_at,
  };
}

async function invokeJobs<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("jobs", { body });
  if (error) throw new Error(await functionErrorMessage(error));
  return data as T;
}

export function searchJobs(search: JobSearch, page: number) {
  return invokeJobs<{ jobs: JobListing[]; total: number }>({ action: "search", ...search, page });
}

/** The saved set, without calling Adzuna or Groq. */
export async function fetchRecommendations(): Promise<Recommendations | null> {
  const { data, error } = await supabase.from("job_recommendations").select("jobs, searches, generated_at").maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toRecommendations(data) : null;
}

/** Runs a fresh search and ranking. Takes several seconds, and spends shared Adzuna quota. */
export async function generateRecommendations(): Promise<Recommendations> {
  const data = await invokeJobs<{ recommendations: { jobs: unknown; searches: unknown; generated_at: string } }>({ action: "recommend" });
  return toRecommendations(data.recommendations);
}

function money(n: number) {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`;
}

/** "$60k – $80k", or "" when Adzuna has nothing. */
export function formatSalary(job: Pick<JobListing, "salaryMin" | "salaryMax">): string {
  const { salaryMin: min, salaryMax: max } = job;
  if (min && max && Math.round(min / 1000) !== Math.round(max / 1000)) return `${money(min)} – ${money(max)}`;
  if (min || max) return money((min || max)!);
  return "";
}

/** Matches a listing to a tracked application by company and title, however the role was added. */
export function roleKey(company: string, title: string) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return `${norm(company)}|${norm(title)}`;
}
