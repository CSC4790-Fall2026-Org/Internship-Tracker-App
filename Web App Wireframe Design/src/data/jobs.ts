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
  jobType: JobType;
  /** The profile's fields when this set was built. Changing them makes a refresh a new question. */
  careerFields: string[];
  generatedAt: string;
}

/** The saved sets, one per job type the user has run. */
export type RecommendationSets = Partial<Record<JobType, Recommendations>>;

export type JobSort = "relevance" | "date";

/** "auto" lets the AI pick internship vs. full-time from the graduation date. */
export type JobType = "auto" | "internship" | "new_grad" | "full_time" | "part_time";

export const JOB_TYPE_LABEL: Record<JobType, string> = {
  auto: "Any type",
  internship: "Internship",
  new_grad: "New grad",
  full_time: "Full-time",
  part_time: "Part-time",
};

/** The same choice phrased as where someone is in their career, for onboarding and Profile. */
export const CAREER_STAGES: { value: JobType; label: string; hint: string }[] = [
  { value: "internship", label: "Student looking for internships", hint: "Internships and co-ops" },
  { value: "new_grad", label: "Graduating within a year, or a recent grad", hint: "Full-time new grad and entry-level roles" },
  { value: "full_time", label: "Working, looking for my next role", hint: "Full-time roles, no internships" },
  { value: "part_time", label: "Looking for part-time work", hint: "Part-time roles" },
  { value: "auto", label: "Not sure yet", hint: "We'll go by your graduation date" },
];

export type CareerField = "software" | "engineering" | "data" | "healthcare" | "finance" | "business" | "marketing" | "design" | "science" | "education" | "government" | "law" | "media";

/** What kind of work someone does. Same codes as the check constraint on resume_profiles.career_fields. */
export const CAREER_FIELDS: { value: CareerField; label: string }[] = [
  { value: "software", label: "Software & IT" },
  { value: "engineering", label: "Engineering" },
  { value: "data", label: "Data & analytics" },
  { value: "healthcare", label: "Healthcare" },
  { value: "finance", label: "Finance & accounting" },
  { value: "business", label: "Business & consulting" },
  { value: "marketing", label: "Marketing & sales" },
  { value: "design", label: "Design & creative" },
  { value: "science", label: "Science & research" },
  { value: "education", label: "Education" },
  { value: "government", label: "Government & nonprofit" },
  { value: "law", label: "Law & policy" },
  { value: "media", label: "Media & communications" },
];

export const MAX_CAREER_FIELDS = 3;

export interface JobSearch {
  what: string;
  where: string;
  sort: JobSort;
  jobType: JobType;
}

type RecommendationRow = { jobs: unknown; searches: unknown; job_type: string; career_fields: string[]; generated_at: string };

function toRecommendations(row: RecommendationRow): Recommendations {
  // jsonb columns arrive as Json and need narrowing.
  return {
    jobs: (row.jobs as JobRecommendation[]) ?? [],
    searches: (row.searches as Recommendations["searches"]) ?? [],
    jobType: row.job_type as JobType,
    careerFields: row.career_fields ?? [],
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

/** The saved sets, without calling Adzuna or Groq. */
export async function fetchRecommendations(): Promise<RecommendationSets> {
  const { data, error } = await supabase.from("job_recommendations").select("jobs, searches, job_type, career_fields, generated_at");
  if (error) throw new Error(error.message);
  return Object.fromEntries(data.map((row) => [row.job_type, toRecommendations(row)]));
}

export type SavedSearch = Recommendations["searches"][number];

/** At most this many searches per run; the server enforces it too. */
export const MAX_SEARCHES = 5;

/**
 * Runs a fresh search and ranking. Takes several seconds, and spends shared Adzuna quota.
 * Without `searches`, the AI plans them from the resume profile.
 */
export async function generateRecommendations(searches?: SavedSearch[]): Promise<Recommendations> {
  const data = await invokeJobs<{ recommendations: RecommendationRow }>({ action: "recommend", searches });
  return toRecommendations(data.recommendations);
}

// Same cooldowns as the "jobs" Edge Function, which enforces them. Every user shares one Adzuna quota.
const REFRESH_COOLDOWN_MS = 10 * 60_000;
const CHANGED_COOLDOWN_MS = 60_000;

/**
 * When the server will next accept a run for this job type, as epoch ms. A repeat run (same type, fields
 * and searches, or AI-planned searches) waits longer, since the results barely change.
 */
export function nextRunAt(sets: RecommendationSets, jobType: JobType, careerFields: string[], repeat: boolean): number {
  const all = Object.values(sets);
  if (all.length === 0) return 0;
  const lastRun = Math.max(...all.map((s) => new Date(s.generatedAt).getTime()));
  const existing = sets[jobType];
  const sameFields = !!existing && [...existing.careerFields].sort().join() === [...careerFields].sort().join();
  const refreshAt = repeat && sameFields ? new Date(existing.generatedAt).getTime() + REFRESH_COOLDOWN_MS : 0;
  return Math.max(lastRun + CHANGED_COOLDOWN_MS, refreshAt);
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
