import type { Application, AppStatus } from "./types";
import { todayISO } from "./dates";

// Export and import share these headers, so an exported file imports back cleanly.
const COLUMNS = [
  { key: "company", header: "Company" },
  { key: "position", header: "Position" },
  { key: "status", header: "Status" },
  { key: "appliedDate", header: "Applied Date" },
  { key: "deadline", header: "Deadline" },
  { key: "location", header: "Location" },
  { key: "salary", header: "Salary" },
  { key: "jobUrl", header: "Job URL" },
  { key: "notes", header: "Notes" },
] as const;

type Field = (typeof COLUMNS)[number]["key"];

export type ImportedApplication = Record<Field, string> & { status: AppStatus };

function escapeCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const STATUS_LABEL: Record<AppStatus, string> = {
  wishlist: "Wishlist",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Closed",
};

export function applicationsToCsv(apps: Application[]): string {
  const lines = [COLUMNS.map((c) => c.header).join(",")];
  for (const app of apps) {
    lines.push(COLUMNS.map((c) => escapeCell(c.key === "status" ? STATUS_LABEL[app.status] : app[c.key] ?? "")).join(","));
  }
  return lines.join("\r\n");
}

export function downloadCsv(csv: string, filename: string) {
  // The BOM makes Excel open the file as UTF-8 instead of mangling accented characters.
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportFilename() {
  return `pipeline-applications-${todayISO()}.csv`;
}

/** RFC 4180 parsing: quoted fields may contain commas, doubled quotes, and line breaks. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  text = text.replace(/^﻿/, "");

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row);
      row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

// Header names people commonly use in their own tracking spreadsheets, normalized by `norm`.
const HEADER_ALIASES: Record<Field, string[]> = {
  company: ["company", "company name", "employer", "organization", "org", "firm"],
  position: ["position", "role", "title", "job title", "job", "position title", "role title", "job role"],
  status: ["status", "stage", "application status", "state"],
  appliedDate: ["applied date", "applied", "date applied", "application date", "applied on", "date submitted"],
  deadline: ["deadline", "due", "due date", "application deadline", "close date", "closing date"],
  location: ["location", "city", "office", "office location"],
  salary: ["salary", "pay", "compensation", "comp", "stipend", "hourly rate", "wage"],
  jobUrl: ["job url", "url", "link", "job link", "posting", "posting url", "job posting", "application link"],
  notes: ["notes", "note", "comments", "comment"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Order matters: "not applied" must hit wishlist before "applied" matches.
const STATUS_PATTERNS: [AppStatus, RegExp][] = [
  ["wishlist", /wish|saved|interested|not applied|to apply|planning|bookmark/],
  ["rejected", /reject|closed|declin|withdr|ghost|no offer|denied/],
  ["offer", /offer|accepted/],
  ["interviewing", /interview|screen|onsite|assessment|\boa\b|final round|superday/],
  ["applied", /appl|submit|pending|review|waiting/],
];

function toStatus(raw: string, appliedDate: string): AppStatus {
  const s = norm(raw);
  const match = STATUS_PATTERNS.find(([, re]) => re.test(s));
  if (match) return match[0];
  return appliedDate ? "applied" : "wishlist";
}

/** Returns "YYYY-MM-DD", or "" when the value isn't a recognizable date. */
function toISODate(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const pad = (n: number) => String(n).padStart(2, "0");
  const us = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (us) {
    const year = us[3].length === 2 ? 2000 + Number(us[3]) : Number(us[3]);
    return `${year}-${pad(Number(us[1]))}-${pad(Number(us[2]))}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface CsvImportResult {
  rows: ImportedApplication[];
  /** Rows with no company or no position. */
  skipped: number;
  /** Headers that didn't match any field. */
  ignoredColumns: string[];
}

export function csvToApplications(text: string): CsvImportResult {
  const [header, ...body] = parseCsv(text);
  if (!header) return { rows: [], skipped: 0, ignoredColumns: [] };

  const columnFor = new Map<Field, number>();
  const ignoredColumns: string[] = [];
  header.forEach((h, i) => {
    const field = (Object.keys(HEADER_ALIASES) as Field[]).find((f) => HEADER_ALIASES[f].includes(norm(h)));
    if (field && !columnFor.has(field)) columnFor.set(field, i);
    else if (h.trim()) ignoredColumns.push(h.trim());
  });

  const rows: ImportedApplication[] = [];
  let skipped = 0;
  for (const cells of body) {
    const get = (f: Field) => {
      const i = columnFor.get(f);
      return i === undefined ? "" : (cells[i] ?? "").trim();
    };
    if (!get("company") || !get("position")) { skipped++; continue; }
    const appliedDate = toISODate(get("appliedDate"));
    rows.push({
      company: get("company"),
      position: get("position"),
      status: toStatus(get("status"), appliedDate),
      appliedDate,
      deadline: toISODate(get("deadline")),
      location: get("location"),
      salary: get("salary"),
      jobUrl: get("jobUrl"),
      notes: get("notes"),
    });
  }
  return { rows, skipped, ignoredColumns };
}
