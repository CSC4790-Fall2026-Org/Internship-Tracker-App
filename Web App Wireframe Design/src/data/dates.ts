// Postgres `date` columns come back as "YYYY-MM-DD". `new Date("YYYY-MM-DD")` parses that as UTC midnight,
// which renders as the previous day in US timezones, so parse date-only strings as local time instead.
export function toDate(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + "T00:00:00") : new Date(value);
}

export function isoOf(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO(): string {
  return isoOf(new Date());
}

/** The local date `days` away from today, as "YYYY-MM-DD". */
export function addDaysISO(days: number, from: string = todayISO()): string {
  const d = toDate(from);
  return isoOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

export function daysUntil(value: string): number {
  return Math.round((toDate(value).getTime() - toDate(todayISO()).getTime()) / 86_400_000);
}

/** "Oct 18", with the year added only when it isn't this year. */
export function formatDate(value: string, opts: { weekday?: boolean; long?: boolean } = {}): string {
  if (!value) return "";
  const date = toDate(value);
  return date.toLocaleDateString("en-US", {
    weekday: opts.weekday ? "short" : undefined,
    month: opts.long ? "long" : "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() || opts.long ? "numeric" : undefined,
  });
}

/** "Today", "Tomorrow", "In 5 days", "3 days ago". */
export function relativeDay(value: string): string {
  const days = daysUntil(value);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1) return days < 14 ? `In ${days} days` : `In ${Math.round(days / 7)} weeks`;
  return -days < 14 ? `${-days} days ago` : `${Math.round(-days / 7)} weeks ago`;
}

/** How loudly a due date should read: overdue is red, the next three days amber. */
export function dueTone(value: string): "danger" | "warning" | "neutral" {
  const days = daysUntil(value);
  if (days < 0) return "danger";
  if (days <= 3) return "warning";
  return "neutral";
}

export function formatTime(time: string): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function timeAgo(value: string): string {
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
