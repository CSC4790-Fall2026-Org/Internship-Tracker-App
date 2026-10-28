// Turns an extracted job posting into values for the Add application form.
// Kept free of the Supabase client so it can be unit-tested; the network call lives in jobPosting.ts.
import type { EmploymentType, ExtractedPosting, SalaryPeriod, WorkMode } from "../../supabase/functions/_shared/jobPosting.ts";

export type { ExtractedPosting };

/** The form fields an import can fill. Notes is appended to, never replaced. */
export type PrefillField = "company" | "position" | "jobUrl" | "deadline" | "location" | "salary";
export const PREFILL_FIELDS: PrefillField[] = ["company", "position", "jobUrl", "deadline", "location", "salary"];

export const PREFILL_LABEL: Record<PrefillField, string> = {
  company: "Company",
  position: "Position",
  jobUrl: "Job posting",
  deadline: "Application deadline",
  location: "Location",
  salary: "Compensation",
};

const WORK_MODE_LABEL: Record<WorkMode, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };
const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  internship: "Internship",
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
};
const PERIOD_SUFFIX: Record<SalaryPeriod, string> = { hour: "/hr", year: "/yr" };

// The raw description is kept in notes, but a whole scraped page shouldn't be.
const MAX_DESCRIPTION_IN_NOTES = 15_000;

const money = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/** "$40–$45/hr", "Up to $140,000/yr", "$25+/hr", or "" when no amount was stated. */
export function formatSalary(p: Pick<ExtractedPosting, "salary_min" | "salary_max" | "salary_period">): string {
  const suffix = p.salary_period ? PERIOD_SUFFIX[p.salary_period] : "";
  const { salary_min: min, salary_max: max } = p;
  if (min !== null && max !== null) return min === max ? `${money(min)}${suffix}` : `${money(min)}–${money(max)}${suffix}`;
  if (min !== null) return `${money(min)}+${suffix}`;
  if (max !== null) return `Up to ${money(max)}${suffix}`;
  return "";
}

/** Location plus work mode, in the form's own "New York, NY · Hybrid" style. */
export function formatLocation(p: Pick<ExtractedPosting, "location" | "work_mode">): string {
  const mode = p.work_mode ? WORK_MODE_LABEL[p.work_mode] : "";
  if (!p.location) return mode;
  // "Remote" as the location already says it; so does "Hybrid - Boston" or "Boston (on-site)".
  const alreadySaid = mode && p.location.toLowerCase().replace(/[\s-]/g, "").includes(mode.toLowerCase().replace(/[\s-]/g, ""));
  return mode && !alreadySaid ? `${p.location} · ${mode}` : p.location;
}

/** The readable block added to notes: what the form has no field for, then the description itself. */
export function postingNotes(p: ExtractedPosting, description: string): string {
  const facts = [
    p.employment_type && `Type: ${EMPLOYMENT_LABEL[p.employment_type]}`,
    p.work_mode && `Work mode: ${WORK_MODE_LABEL[p.work_mode]}`,
    p.start_date && `Start date: ${p.start_date}`,
  ].filter(Boolean);

  const sections: string[] = [];
  if (p.summary) sections.push(`Summary: ${p.summary}`);
  if (facts.length) sections.push(facts.join("\n"));
  if (p.requirements.length) sections.push(`Requirements:\n${p.requirements.map((r) => `- ${r}`).join("\n")}`);

  const text = description.trim();
  if (text) {
    const kept = text.length > MAX_DESCRIPTION_IN_NOTES ? `${text.slice(0, MAX_DESCRIPTION_IN_NOTES)}\n[…truncated]` : text;
    sections.push(`--- Job description ---\n${kept}`);
  }
  return sections.length ? `Imported from job posting\n\n${sections.join("\n\n")}` : "";
}

/**
 * Form values from an extracted posting. Fields the posting didn't state are left out (not set to ""),
 * so they stay empty or keep whatever the user typed.
 */
export function postingToForm(p: ExtractedPosting, input: { text: string; url: string }): { fields: Partial<Record<PrefillField, string>>; notes: string } {
  const candidates: Record<PrefillField, string> = {
    company: p.company ?? "",
    position: p.title ?? "",
    jobUrl: input.url.trim(),
    deadline: p.deadline ?? "",
    location: formatLocation(p),
    salary: formatSalary(p),
  };
  const fields: Partial<Record<PrefillField, string>> = {};
  for (const field of PREFILL_FIELDS) if (candidates[field]) fields[field] = candidates[field];
  return { fields, notes: postingNotes(p, input.text) };
}

/** Fields where the user already typed something different from what the import would put there. */
export function conflictingFields(current: Record<PrefillField, string>, incoming: Partial<Record<PrefillField, string>>): PrefillField[] {
  return PREFILL_FIELDS.filter((f) => {
    const next = incoming[f];
    const now = current[f].trim();
    return next !== undefined && now !== "" && now !== next;
  });
}

/** Adds the imported block to whatever notes the user already wrote. */
export function appendNotes(current: string, imported: string): string {
  if (!imported) return current;
  if (!current.trim()) return imported;
  if (current.includes(imported)) return current;
  return `${current.trimEnd()}\n\n${imported}`;
}
