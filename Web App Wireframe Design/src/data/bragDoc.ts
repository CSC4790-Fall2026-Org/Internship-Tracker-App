// The brag doc is a view over the career log: nothing is stored separately, so editing or deleting
// an entry in the log changes the brag doc too.
import { CAREER_CATEGORIES, type CareerCategory, type CareerLogEntry } from "./careerLog";
import { formatDate, toDate, todayISO } from "./dates";

/** The categories that read as evidence of impact. Skills and milestones stay in the log. */
export const BRAG_CATEGORIES: CareerCategory[] = ["accomplishment", "project", "feedback"];

export type BragPeriod = "month" | "quarter" | "year";

export interface BragSection {
  key: string;
  label: string;
  groups: { category: CareerCategory; label: string; entries: CareerLogEntry[] }[];
  count: number;
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function periodOf(date: string, period: BragPeriod): { key: string; label: string } {
  const d = toDate(date);
  const year = d.getFullYear();
  const month = d.getMonth();
  if (period === "year") return { key: String(year), label: String(year) };
  if (period === "month") {
    return { key: `${year}-${String(month + 1).padStart(2, "0")}`, label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }) };
  }
  const q = Math.floor(month / 3);
  return { key: `${year}-Q${q + 1}`, label: `Q${q + 1} ${year} (${MONTH_SHORT[q * 3]} – ${MONTH_SHORT[q * 3 + 2]})` };
}

/** Newest period first; inside a period, categories in log order and entries newest first. */
export function bragSections(entries: CareerLogEntry[], period: BragPeriod, categories: CareerCategory[] = BRAG_CATEGORIES): BragSection[] {
  const sections = new Map<string, { label: string; byCategory: Map<CareerCategory, CareerLogEntry[]> }>();
  for (const entry of entries) {
    if (!categories.includes(entry.category)) continue;
    const { key, label } = periodOf(entry.date, period);
    const section = sections.get(key) ?? { label, byCategory: new Map() };
    section.byCategory.set(entry.category, [...(section.byCategory.get(entry.category) ?? []), entry]);
    sections.set(key, section);
  }
  return [...sections.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, { label, byCategory }]) => {
      const groups = CAREER_CATEGORIES.filter((c) => byCategory.has(c.value)).map((c) => ({
        category: c.value,
        label: c.plural,
        entries: [...byCategory.get(c.value)!].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
      }));
      return { key, label, groups, count: groups.reduce((n, g) => n + g.entries.length, 0) };
    });
}

const oneLine = (value: string) => value.replace(/\s+/g, " ").trim();

/** Company names for linked applications, keyed by application id. */
type CompanyLookup = (applicationId: string) => string | undefined;

function meta(entry: CareerLogEntry, companyOf: CompanyLookup) {
  const company = entry.applicationId ? companyOf(entry.applicationId) : undefined;
  return [formatDate(entry.date), company].filter(Boolean).join(", ");
}

export function bragDocText(sections: BragSection[], companyOf: CompanyLookup): string {
  const lines = ["Brag doc", `From my career log, as of ${formatDate(todayISO(), { long: true })}`];
  for (const section of sections) {
    lines.push("", section.label, "=".repeat(section.label.length));
    for (const group of section.groups) {
      lines.push("", group.label);
      for (const entry of group.entries) {
        lines.push(`- ${oneLine(entry.title)} (${meta(entry, companyOf)})`);
        if (entry.impact) lines.push(`  Impact: ${oneLine(entry.impact)}`);
        if (entry.details) lines.push(`  ${oneLine(entry.details)}`);
      }
    }
  }
  return lines.join("\n") + "\n";
}

export function bragDocMarkdown(sections: BragSection[], companyOf: CompanyLookup): string {
  const lines = ["# Brag doc", "", `_From my career log, as of ${formatDate(todayISO(), { long: true })}_`];
  for (const section of sections) {
    lines.push("", `## ${section.label}`);
    for (const group of section.groups) {
      lines.push("", `### ${group.label}`, "");
      for (const entry of group.entries) {
        lines.push(`- **${oneLine(entry.title)}** · ${meta(entry, companyOf)}`);
        if (entry.impact) lines.push(`  - Impact: ${oneLine(entry.impact)}`);
        if (entry.details) lines.push(`  - ${oneLine(entry.details)}`);
      }
    }
  }
  return lines.join("\n") + "\n";
}
