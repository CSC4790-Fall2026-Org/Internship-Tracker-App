// The Career coach answers from the user's own data. This builds that data into a compact text summary
// for the career-coach Edge Function, reusing the same derived views as the dashboard (attention items,
// upcoming items) so the coach and the rest of the app tell the same story.
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Application, CalendarEvent, Contact, Task } from "./types";
import { CATEGORY_LABEL, type CareerLogEntry } from "./careerLog";
import { attentionItems, pipelineStats, upcomingItems, KIND_META } from "./insights";
import { STATUS, STATUS_ORDER } from "./status";
import { toDate, todayISO } from "./dates";

export interface CoachMessage {
  role: "user" | "assistant";
  content: string;
}

export const STARTER_PROMPTS = [
  "What should I focus on this week?",
  "Which applications need a follow-up?",
  "Turn my career log into resume bullets",
  "Help me prepare for my next interview",
];

// How much of each kind of data goes into a prompt. The Edge Function enforces an overall cap as well.
const LIMITS = { applications: 40, attention: 15, upcoming: 15, tasks: 15, contacts: 30, careerLog: 25 };
const NOTE_CHARS = 160;
const DETAIL_CHARS = 220;
/** Questions longer than this are cut by the server anyway; the composer stops here so nothing is silently lost. */
export const MAX_QUESTION_CHARS = 2000;
/** How many earlier turns the server keeps, so the page can say when the oldest have dropped out. */
export const HISTORY_SENT = 12;

const clip = (value: string, max: number) => {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const statusRank = (a: Application) => {
  // Live applications first; closed ones last.
  const order: Record<string, number> = { interviewing: 0, offer: 1, applied: 2, wishlist: 3, rejected: 4 };
  return order[a.status] ?? STATUS_ORDER.indexOf(a.status);
};

function applicationLine(app: Application): string {
  const parts = [`${app.company} — ${app.position}`, STATUS[app.status].label];
  if (app.appliedDate) parts.push(`applied ${app.appliedDate}`);
  if (app.deadline) parts.push(`deadline ${app.deadline}`);
  if (app.location) parts.push(app.location);
  if (app.interviewStages.length > 0) {
    const done = app.interviewStages.filter((s) => s.completed).length;
    const next = app.interviewStages.find((s) => !s.completed);
    parts.push(`${app.interviewStages.length} interview round${app.interviewStages.length === 1 ? "" : "s"} (${done} done${next ? `; next: ${next.name}${next.date ? ` on ${next.date}` : ""}` : ""})`);
  }
  if (app.contacts.length > 0) parts.push(`contacts: ${app.contacts.map((c) => c.name).join(", ")}`);
  if (app.notes.trim()) parts.push(`notes: ${clip(app.notes, NOTE_CHARS)}`);
  return `- ${parts.join(" | ")}`;
}

export interface CoachData {
  applications: Application[];
  tasks: Task[];
  contacts: Contact[];
  events: CalendarEvent[];
  careerLog: CareerLogEntry[] | null;
}

export interface CoachContext {
  text: string;
  /** What went in, for the "using your data" line on the page. */
  counts: { applications: number; upcoming: number; contacts: number; careerLog: number };
}

export function buildCoachContext({ applications, tasks, contacts, events, careerLog }: CoachData): CoachContext {
  const today = todayISO();
  const lines: string[] = [`Today is ${toDate(today).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} (${today}).`];
  const section = (title: string, rows: string[], total: number, empty: string) => {
    lines.push("", `## ${title}${total > rows.length ? ` (showing ${rows.length} of ${total})` : ""}`);
    lines.push(...(rows.length > 0 ? rows : [empty]));
  };

  const stats = pipelineStats(applications);
  lines.push(
    "",
    `Pipeline: ${stats.total} application${stats.total === 1 ? "" : "s"} — ${stats.wishlist} wishlist, ${stats.awaiting} applied and waiting, ${stats.interviewing} interviewing, ${stats.offers} offers, ${stats.closed} closed.` +
      (stats.responseRate !== null ? ` Response rate ${stats.responseRate}%.` : "") +
      (stats.interviewRate !== null ? ` Interview rate ${stats.interviewRate}%.` : ""),
  );

  const apps = [...applications].sort((a, b) => statusRank(a) - statusRank(b) || (b.appliedDate || "").localeCompare(a.appliedDate || ""));
  section("Applications", apps.slice(0, LIMITS.applications).map(applicationLine), apps.length, "None yet.");

  const attention = attentionItems(applications, tasks);
  section(
    "Needs attention (same list as the dashboard)",
    attention.slice(0, LIMITS.attention).map((a) => `- ${a.title}${a.detail ? ` — ${a.detail}` : ""} (${a.when})`),
    attention.length,
    "Nothing flagged.",
  );

  const upcoming = upcomingItems(applications, tasks, events, 21);
  section(
    "Next 3 weeks: deadlines, interviews, tasks, events",
    upcoming.slice(0, LIMITS.upcoming).map((u) => `- ${u.date}${u.time ? ` ${u.time}` : ""} ${KIND_META[u.kind].label}: ${u.label}${u.detail ? ` — ${clip(u.detail, 80)}` : ""}`),
    upcoming.length,
    "Nothing scheduled.",
  );

  const openTasks = tasks.filter((t) => !t.done);
  section(
    "Open tasks",
    openTasks.slice(0, LIMITS.tasks).map((t) => `- ${t.text}${t.company ? ` (${t.company})` : ""}${t.due ? ` due ${t.due}` : ""}`),
    openTasks.length,
    "None.",
  );

  // A contact is worth a follow-up when one of their linked applications has gone quiet.
  const followUpApps = new Set(attention.filter((a) => a.kind === "follow-up" && a.appId).map((a) => a.appId!));
  const appById = new Map(applications.map((a) => [a.id, a]));
  const people = [...contacts].sort((a, b) => Number(b.applicationIds.some((id) => followUpApps.has(id))) - Number(a.applicationIds.some((id) => followUpApps.has(id))));
  section(
    "Networking contacts",
    people.slice(0, LIMITS.contacts).map((c) => {
      const linked = c.applicationIds.map((id) => appById.get(id)).filter((a): a is Application => !!a);
      const parts = [c.name, [c.role, c.company].filter(Boolean).join(" at ")].filter(Boolean);
      if (linked.length > 0) parts.push(`linked to ${linked.map((a) => `${a.company} (${STATUS[a.status].label})`).join(", ")}`);
      if (c.applicationIds.some((id) => followUpApps.has(id))) parts.push("linked application needs a follow-up");
      if (!c.email && !c.phone) parts.push("no contact details saved");
      if (c.notes.trim()) parts.push(`notes: ${clip(c.notes, NOTE_CHARS)}`);
      return `- ${parts.join(" | ")}`;
    }),
    people.length,
    "None yet.",
  );

  if (careerLog === null) {
    lines.push("", "## Career log", "Couldn't be loaded right now.");
  } else {
    section(
      "Career log (most recent first)",
      careerLog.slice(0, LIMITS.careerLog).map((e) => {
        const app = e.applicationId ? appById.get(e.applicationId) : undefined;
        const parts = [`${e.date} [${CATEGORY_LABEL[e.category]}] ${clip(e.title, 140)}`];
        if (e.impact) parts.push(`impact: ${clip(e.impact, 160)}`);
        if (e.details) parts.push(clip(e.details, DETAIL_CHARS));
        if (app) parts.push(`re: ${app.company}`);
        return `- ${parts.join(" | ")}`;
      }),
      careerLog.length,
      "No entries yet.",
    );
  }

  return {
    text: lines.join("\n"),
    counts: { applications: applications.length, upcoming: upcoming.length, contacts: contacts.length, careerLog: careerLog?.length ?? 0 },
  };
}

/** Sends the conversation and returns the coach's reply, or throws an Error with a message fit to show. */
export async function askCoach(messages: CoachMessage[], context: string): Promise<string> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw new Error("You've been signed out. Sign in again to keep chatting.");

  const { data, error } = await supabase.functions.invoke("career-coach", {
    body: { messages: messages.slice(-HISTORY_SENT), context },
    timeout: 60_000,
  });
  if (!error) {
    if (typeof data?.reply !== "string") throw new Error("The coach sent back something unexpected. Try again.");
    return data.reply;
  }

  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response;
    const body = await res.json().catch(() => null);
    if (res.status === 401) throw new Error("Your session has expired. Sign out and back in to keep chatting.");
    if (res.status === 404) throw new Error("The career coach isn't set up yet: the career-coach Edge Function hasn't been deployed.");
    throw new Error(body?.error ?? `The coach couldn't answer (error ${res.status}). Try again in a moment.`);
  }
  if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
    // invoke()'s timeout aborts the request, which surfaces as an AbortError inside a FunctionsFetchError.
    if (["AbortError", "TimeoutError"].includes((error.context as { name?: string } | undefined)?.name ?? "")) {
      throw new Error("The coach took too long to answer. Try again, or ask something narrower.");
    }
    throw new Error("Couldn't reach the coach. Check your connection and try again.");
  }
  throw new Error(error.message);
}
