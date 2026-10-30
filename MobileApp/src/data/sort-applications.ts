// Same sorting as the website's Applications table (src/pages/ApplicationsTable.tsx), which keeps these
// inside the page rather than in src/data. Keep the two in step.
import type { Application } from "@shared/data/types";
import { STATUS_ORDER } from "@shared/data/status";

export type SortField = "deadline" | "company" | "position" | "status" | "appliedDate" | "salary" | "location";

export const SORT_LABEL: Record<SortField, string> = {
  deadline: "Deadline",
  company: "Company",
  position: "Position",
  status: "Stage",
  appliedDate: "Applied",
  salary: "Pay",
  location: "Location",
};

/** Rough annualized number for sorting free-text pay like "$42/hr", "$120k" or "$85,000". */
function payValue(salary: string): number | null {
  const match = salary.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(k)?/i);
  if (!match) return null;
  let n = parseFloat(match[1]) * (match[2] ? 1000 : 1);
  if (/hr|hour/i.test(salary) || n < 300) n *= 2080;
  return n;
}

function sortValue(app: Application, field: SortField): string | number | null {
  if (field === "status") return STATUS_ORDER.indexOf(app.status);
  if (field === "salary") return payValue(app.salary);
  const v = app[field];
  return v ? v.toLowerCase() : null;
}

/** Sorted copy. Blanks sink to the bottom whichever way you sort; ties fall back to company name. */
export function sortApplications(apps: Application[], field: SortField, dir: "asc" | "desc"): Application[] {
  return [...apps].sort((a, b) => {
    const av = sortValue(a, field);
    const bv = sortValue(b, field);
    if (av === null || bv === null) return av === bv ? 0 : av === null ? 1 : -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return (dir === "asc" ? cmp : -cmp) || a.company.localeCompare(b.company);
  });
}

/** Same fields the website's search looks in. */
export const matchesSearch = (app: Application, query: string) => {
  const q = query.trim().toLowerCase();
  return !q || [app.company, app.position, app.location, app.notes].some((f) => f.toLowerCase().includes(q));
};
