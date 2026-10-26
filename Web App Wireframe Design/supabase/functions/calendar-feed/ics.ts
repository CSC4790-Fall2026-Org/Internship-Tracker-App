// Builds an iCalendar (RFC 5545) feed. No Deno APIs, so it can be tested on its own.

export interface FeedItem {
  /** Stable across fetches, so Google updates the event in place instead of adding a copy. */
  uid: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM or HH:MM:SS; null for an all-day item. */
  time: string | null;
  summary: string;
  description: string;
  category: string;
  /** ISO timestamp of the last change, used for DTSTAMP. */
  updated: string;
}

const escapeText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const encoder = new TextEncoder();

// Lines may be at most 75 bytes; longer ones continue on lines starting with a space. Never splits a character.
function fold(line: string) {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (bytes + size > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

const basicDate = (iso: string) => iso.replaceAll("-", "");

function nextDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10).replaceAll("-", "");
}

const basicTime = (time: string) => `${time.slice(0, 5).replace(":", "")}00`;
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Timed items are an hour long in `timezone`; untimed ones are all-day and don't mark the person busy. */
export function buildCalendar(items: FeedItem[], { name, timezone }: { name: string; timezone: string }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pipeline//Calendar feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    `X-WR-TIMEZONE:${timezone}`,
    // Google ignores these and refreshes on its own schedule; Apple and Outlook honour them.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const item of items) {
    lines.push("BEGIN:VEVENT", `UID:${item.uid}`, `DTSTAMP:${stamp(item.updated)}`);
    if (item.time) {
      lines.push(`DTSTART;TZID=${timezone}:${basicDate(item.date)}T${basicTime(item.time)}`, "DURATION:PT1H");
    } else {
      lines.push(`DTSTART;VALUE=DATE:${basicDate(item.date)}`, `DTEND;VALUE=DATE:${nextDay(item.date)}`, "TRANSP:TRANSPARENT");
    }
    lines.push(`SUMMARY:${escapeText(item.summary)}`);
    if (item.description) lines.push(`DESCRIPTION:${escapeText(item.description)}`);
    lines.push(`CATEGORIES:${escapeText(item.category)}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
