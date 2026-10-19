// Derived views over the user's real data, shared by the dashboard, sidebar, board insights and calendar
// so every screen tells the same story. Nothing here invents numbers: each figure counts actual rows.
import type { Application, CalendarEvent, Task } from "./types";
import { addDaysISO, daysUntil, formatDate, relativeDay, toDate, todayISO } from "./dates";

/** Applications that have left the wishlist. */
export const isSubmitted = (a: Application) => a.status !== "wishlist";

/** Reached at least one interview: the status says so, or rounds were logged before it closed. */
export const reachedInterview = (a: Application) =>
  a.status === "interviewing" || a.status === "offer" || (a.status !== "wishlist" && a.interviewStages.length > 0);

/** Applied for this many days with no reply or interview logged before we suggest a follow-up. */
export const FOLLOW_UP_AFTER_DAYS = 14;

// ---------- Pipeline numbers ----------

export function pipelineStats(applications: Application[]) {
  const submitted = applications.filter(isSubmitted);
  const interviewed = submitted.filter(reachedInterview);
  // "Heard back": anything that moved past Applied, including a rejection.
  const heardBack = submitted.filter((a) => a.status !== "applied" || reachedInterview(a));
  const offers = applications.filter((a) => a.status === "offer");
  const pct = (n: number, of: number) => (of === 0 ? null : Math.round((n / of) * 100));
  return {
    total: applications.length,
    wishlist: applications.length - submitted.length,
    submitted: submitted.length,
    active: applications.filter((a) => a.status === "applied" || a.status === "interviewing").length,
    awaiting: applications.filter((a) => a.status === "applied").length,
    interviewing: applications.filter((a) => a.status === "interviewing").length,
    interviewed: interviewed.length,
    heardBack: heardBack.length,
    offers: offers.length,
    closed: applications.filter((a) => a.status === "rejected").length,
    responseRate: pct(heardBack.length, submitted.length),
    interviewRate: pct(interviewed.length, submitted.length),
    offerRate: pct(offers.length, interviewed.length),
  };
}

/** Submissions per week (by applied date), oldest first, ending with the current week. Weeks start Monday. */
export function weeklySubmissions(applications: Application[], weeks = 12) {
  const today = toDate(todayISO());
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - (weeks - 1 - i) * 7);
    return { start, count: 0 };
  });
  const firstStart = buckets[0].start.getTime();
  for (const a of applications) {
    if (!a.appliedDate) continue;
    const t = toDate(a.appliedDate).getTime();
    if (t < firstStart) continue;
    const index = Math.floor((t - firstStart) / (7 * 86_400_000));
    if (index >= 0 && index < weeks) buckets[index].count += 1;
  }
  return buckets.map((b) => ({
    label: b.start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    count: b.count,
  }));
}

// ---------- Needs attention ----------

export type AttentionKind = "task-overdue" | "task-today" | "deadline-passed" | "deadline-soon" | "interview-soon" | "stage-unlogged" | "follow-up";

/** The four kinds of work the dashboard lets you filter by. */
export type AttentionGroup = "tasks" | "deadlines" | "interviews" | "follow-ups";

export const ATTENTION_GROUP: Record<AttentionKind, AttentionGroup> = {
  "task-overdue": "tasks",
  "task-today": "tasks",
  "deadline-passed": "deadlines",
  "deadline-soon": "deadlines",
  "interview-soon": "interviews",
  "stage-unlogged": "interviews",
  "follow-up": "follow-ups",
};

export interface AttentionItem {
  key: string;
  kind: AttentionKind;
  severity: "danger" | "warning" | "info";
  title: string;
  detail: string;
  /** Short, scannable timing: "Tomorrow", "2 days late". */
  when: string;
  /** Sort key: lower is more urgent. */
  rank: number;
  appId?: string;
  taskId?: string;
  stageId?: string;
}

/**
 * Ordered by what can still be acted on soonest: an interview or deadline in the next two days outranks
 * an overdue task, which outranks things that have already slipped (a passed deadline, a quiet application).
 */
export function attentionItems(applications: Application[], tasks: Task[]): AttentionItem[] {
  const today = todayISO();
  const out: AttentionItem[] = [];

  for (const task of tasks) {
    if (task.done || !task.due || task.due > today) continue;
    const days = daysUntil(task.due);
    out.push({
      key: `task-${task.id}`,
      kind: days < 0 ? "task-overdue" : "task-today",
      severity: days < 0 ? "danger" : "warning",
      title: task.text,
      detail: task.company,
      when: days < 0 ? `Due ${relativeDay(task.due).toLowerCase()}` : "Due today",
      rank: days < 0 ? 30 + days / 100 : 35,
      appId: task.applicationId ?? undefined,
      taskId: task.id,
    });
  }

  for (const app of applications) {
    if (app.status === "wishlist" && app.deadline) {
      const days = daysUntil(app.deadline);
      if (days < 0 && days >= -14) {
        out.push({
          key: `deadline-${app.id}`,
          kind: "deadline-passed",
          severity: "info",
          title: `${app.company} deadline passed`,
          detail: `${app.position} · Still on your wishlist`,
          when: `Due ${relativeDay(app.deadline).toLowerCase()}`,
          rank: 60 - days / 100,
          appId: app.id,
        });
      } else if (days >= 0 && days <= 7) {
        out.push({
          key: `deadline-${app.id}`,
          kind: "deadline-soon",
          severity: days <= 2 ? "danger" : "warning",
          title: `Apply to ${app.company}`,
          detail: app.position,
          when: days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due in ${days} days`,
          rank: (days <= 2 ? 20 : 50) + days,
          appId: app.id,
        });
      }
    }

    if (app.status === "applied" || app.status === "interviewing") {
      for (const stage of app.interviewStages) {
        if (stage.completed || !stage.date) continue;
        const days = daysUntil(stage.date);
        if (days >= 0 && days <= 2) {
          out.push({
            key: `stage-${stage.id}`,
            kind: "interview-soon",
            severity: "warning",
            title: `Prepare for ${app.company} ${stage.name.toLowerCase()}`,
            detail: app.position,
            when: relativeDay(stage.date),
            rank: 10 + days,
            appId: app.id,
            stageId: stage.id,
          });
        } else if (days < 0) {
          out.push({
            key: `stage-${stage.id}`,
            kind: "stage-unlogged",
            severity: "warning",
            title: `How did the ${app.company} ${stage.name.toLowerCase()} go?`,
            detail: app.position,
            when: `Was ${formatDate(stage.date)}`,
            rank: 40 - days / 100,
            appId: app.id,
            stageId: stage.id,
          });
        }
      }
    }

    if (app.status === "applied" && app.appliedDate && app.interviewStages.length === 0) {
      const waited = -daysUntil(app.appliedDate);
      if (waited >= FOLLOW_UP_AFTER_DAYS) {
        out.push({
          key: `follow-${app.id}`,
          kind: "follow-up",
          severity: "info",
          title: `Follow up with ${app.company}`,
          detail: `${app.position} · No response logged`,
          when: `Applied ${waited} days ago`,
          rank: 70 - waited / 1000,
          appId: app.id,
        });
      }
    }
  }

  return out.sort((a, b) => a.rank - b.rank);
}

// ---------- Dated items (calendar & agenda) ----------

export type ItemKind = "deadline" | "interview" | "task" | "event";

export const KIND_META: Record<ItemKind, { label: string; dot: string; chip: string }> = {
  deadline: { label: "Deadline", dot: "bg-kind-deadline", chip: "bg-danger-soft text-danger-fg" },
  interview: { label: "Interview", dot: "bg-kind-interview", chip: "bg-status-interviewing-soft text-status-interviewing-fg" },
  event: { label: "Event", dot: "bg-kind-event", chip: "bg-accent-soft text-accent-fg" },
  task: { label: "Task", dot: "bg-kind-task", chip: "bg-muted text-fg-2" },
};

export interface CalendarItem {
  id: string;
  kind: ItemKind;
  date: string;
  label: string;
  detail: string;
  time: string;
  applicationId: string | null;
  event?: CalendarEvent;
}

/** Everything dated, from all four sources, in date-then-time order. */
export function calendarItems(applications: Application[], tasks: Task[], events: CalendarEvent[]): CalendarItem[] {
  const out: CalendarItem[] = [];
  for (const app of applications) {
    if (app.deadline && app.status !== "rejected") {
      out.push({ id: `deadline-${app.id}`, kind: "deadline", date: app.deadline, label: `${app.company} deadline`, detail: app.position, time: "", applicationId: app.id });
    }
    for (const stage of app.interviewStages) {
      if (stage.date) {
        out.push({ id: `stage-${stage.id}`, kind: "interview", date: stage.date, label: `${app.company} · ${stage.name}`, detail: app.position, time: "", applicationId: app.id });
      }
    }
  }
  for (const task of tasks) {
    if (task.due && !task.done) {
      out.push({ id: `task-${task.id}`, kind: "task", date: task.due, label: task.text, detail: task.company, time: "", applicationId: task.applicationId });
    }
  }
  for (const event of events) {
    out.push({ id: `event-${event.id}`, kind: "event", date: event.date, label: event.title, detail: event.notes, time: event.startTime, applicationId: event.applicationId, event });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

/**
 * Upcoming items in the next `days` days. Deadlines for offers are dropped: that race is already won.
 * Rounds for closed applications are dropped too: a rejection cancels them, matching the dashboard's "next round".
 */
export function upcomingItems(applications: Application[], tasks: Task[], events: CalendarEvent[], days = 14) {
  const today = todayISO();
  const until = addDaysISO(days);
  const offerIds = new Set(applications.filter((a) => a.status === "offer").map((a) => a.id));
  const completedStages = new Set(
    applications.flatMap((a) => a.interviewStages.filter((s) => s.completed || a.status === "rejected").map((s) => `stage-${s.id}`)),
  );
  return calendarItems(applications, tasks, events).filter(
    (item) =>
      item.date >= today &&
      item.date <= until &&
      !completedStages.has(item.id) &&
      !(item.kind === "deadline" && item.applicationId && offerIds.has(item.applicationId)),
  );
}
