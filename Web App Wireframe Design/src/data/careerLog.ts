import { supabase } from "../lib/supabase";
import type { Tables } from "../lib/database.types";

export type CareerCategory = "accomplishment" | "project" | "feedback" | "skill" | "milestone";

export const CAREER_CATEGORIES: { value: CareerCategory; label: string; plural: string; hint: string }[] = [
  { value: "accomplishment", label: "Accomplishment", plural: "Accomplishments", hint: "Something you shipped, won or improved" },
  { value: "project", label: "Project", plural: "Projects", hint: "Class, personal or work projects" },
  { value: "feedback", label: "Feedback", plural: "Feedback", hint: "Praise or advice from a manager, mentor or interviewer" },
  { value: "skill", label: "Skill", plural: "Skills", hint: "A tool, language or ability you picked up" },
  { value: "milestone", label: "Milestone", plural: "Milestones", hint: "Offers, promotions, certifications, graduations" },
];

export const CATEGORY_LABEL = Object.fromEntries(CAREER_CATEGORIES.map((c) => [c.value, c.label])) as Record<CareerCategory, string>;

export interface CareerLogEntry {
  id: string;
  category: CareerCategory;
  title: string;
  details: string;
  impact: string;
  date: string;
  createdAt: string;
}

export type CareerLogInput = Omit<CareerLogEntry, "id" | "createdAt">;

function toEntry(row: Tables<"career_log_entries">): CareerLogEntry {
  return {
    id: row.id,
    // A check constraint limits category to these values; the generated type is just string.
    category: row.category as CareerCategory,
    title: row.title,
    details: row.details,
    impact: row.impact,
    date: row.date,
    createdAt: row.created_at,
  };
}

function toRow(input: CareerLogInput) {
  return { category: input.category, title: input.title.trim(), details: input.details.trim(), impact: input.impact.trim(), date: input.date };
}

/** Newest first; entries on the same day keep the order they were added in, newest first. */
export async function fetchCareerLog(): Promise<CareerLogEntry[]> {
  const { data, error } = await supabase.from("career_log_entries").select("*").order("date", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map(toEntry);
}

export async function addCareerLogEntry(input: CareerLogInput): Promise<CareerLogEntry> {
  const { data, error } = await supabase.from("career_log_entries").insert(toRow(input)).select().single();
  if (error) throw new Error(error.message);
  return toEntry(data);
}

export async function updateCareerLogEntry(id: string, input: CareerLogInput): Promise<CareerLogEntry> {
  const { data, error } = await supabase.from("career_log_entries").update(toRow(input)).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return toEntry(data);
}

export async function deleteCareerLogEntry(id: string) {
  const { error } = await supabase.from("career_log_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Keeps a list in the same order fetchCareerLog returns. */
export function sortEntries(entries: CareerLogEntry[]): CareerLogEntry[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}
