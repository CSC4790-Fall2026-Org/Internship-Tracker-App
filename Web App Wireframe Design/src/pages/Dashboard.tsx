import { useMemo, useState, type CSSProperties } from "react";
import { useData, type ActivityItem } from "../data/DataContext";
import type { Task } from "../data/types";
import { addDaysISO, daysUntil, formatDate, formatTime, relativeDay, toDate, todayISO } from "../data/dates";
import { ATTENTION_GROUP, attentionItems, KIND_META, pipelineStats, upcomingItems, weeklySubmissions, type AttentionGroup, type AttentionItem, type AttentionKind, type CalendarItem, type ItemKind } from "../data/insights";
import { Button, Card, Checkbox, cx, DueChip, EmptyState, IconButton, Input, LinkButton, Page, PresenceRow, Segmented, Select, Ticker } from "../components/ui";
import { useCountUp, useEntering, useFirstVisit, useMountedFrame, usePresence } from "../lib/motion";
import { ConversionSteps, StageBreakdown, WeeklyColumns } from "../components/charts";
import { useFeedback, errorMessage } from "../components/feedback";
import {
  IconArrowRight,
  IconBriefcase,
  IconCalendar,
  IconCheck,
  IconCheckCircle,
  IconChevronRight,
  IconFlag,
  IconMail,
  IconMessage,
  IconPlus,
  IconSend,
  IconTaskSquare,
  IconTrash,
  IconTrendingUp,
  IconTrophy,
  IconUpload,
  type IconComponent,
} from "../components/icons";

interface DashboardProps {
  onNavigate: (screen: string, id?: string) => void;
  userName: string;
}

type Navigate = DashboardProps["onNavigate"];

// Remembered for the session so the dashboard reopens on the view you last chose.
let lastAgendaTab: "upcoming" | "tasks" = "upcoming";
let lastPipelineTab: "overview" | "weekly" | "activity" = "overview";

/**
 * Three questions, one card each: what needs me, what's coming, how is my search going.
 * Deeper detail (conversion, weekly trend, activity, tasks) sits one tab away instead of on screen at once.
 */
export default function Dashboard({ onNavigate, userName }: DashboardProps) {
  const { applications, tasks, events } = useData();
  const stats = useMemo(() => pipelineStats(applications), [applications]);
  const attention = useMemo(() => attentionItems(applications, tasks), [applications, tasks]);
  const upcoming = useMemo(() => upcomingItems(applications, tasks, events, 14), [applications, tasks, events]);

  const today = todayISO();
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const firstName = userName.split(" ")[0];

  // Rolling seven days including today, so the figure doesn't reset to zero every Monday.
  const weekAgo = addDaysISO(-6);
  const appliedLast7 = applications.filter((a) => a.appliedDate && a.appliedDate >= weekAgo && a.appliedDate <= today).length;
  // Only rounds for applications still in play; a closed one's leftover dates aren't "upcoming".
  const nextRounds = applications
    .filter((a) => a.status === "applied" || a.status === "interviewing")
    .flatMap((a) => a.interviewStages.filter((s) => !s.completed && s.date && s.date >= today).map((s) => ({ company: a.company, date: s.date })))
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextRound = nextRounds[0];

  const summary =
    applications.length === 0 ? (
      "Let's get your search organized."
    ) : attention.length > 0 ? (
      <>
        <Ticker value={attention.length} /> {attention.length === 1 ? "thing needs" : "things need"} your attention.
      </>
    ) : (
      "You're all caught up."
    );

  // First visit this session: blocks rise in, top to bottom. Coming back to the dashboard is instant.
  const entrance = useFirstVisit("dashboard");
  const rise = (i: number): { className?: string; style?: CSSProperties } => (entrance ? { className: "animate-rise", style: { animationDelay: `${i * 45}ms` } } : {});

  return (
    <Page width="medium">
      <header className={cx("mb-6 flex flex-wrap items-end justify-between gap-4 lg:mb-7", rise(0).className)} style={rise(0).style}>
        <div>
          <p className="text-ui text-fg-muted">{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="mt-1 text-[26px] leading-tight font-semibold tracking-[-0.025em] text-fg">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">{summary}</p>
        </div>
        <Button variant="primary" icon={IconPlus} onClick={() => onNavigate("add")}>
          Add application
        </Button>
      </header>

      {applications.length === 0 ? (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <GettingStarted onNavigate={onNavigate} />
          <Card className={cx("p-1", rise(2).className)} style={rise(2).style}>
            <TasksPanel />
          </Card>
        </div>
      ) : (
        <div className="space-y-5 lg:space-y-6">
          <Stats
            rise={rise}
            countUp={entrance}
            items={[
              {
                label: "In progress",
                tone: "applied",
                icon: IconSend,
                value: stats.active,
                sub: appliedLast7 ? `${appliedLast7} applied in the last 7 days` : stats.awaiting ? `${stats.awaiting} awaiting a reply` : `${stats.wishlist} on your wishlist`,
                hint: "Applications in Applied or Interviewing",
                onClick: () => onNavigate("pipeline"),
              },
              {
                label: "Interviewing",
                tone: "interviewing",
                icon: IconMessage,
                value: stats.interviewing,
                sub: nextRound ? `Next: ${nextRound.company}, ${relativeDay(nextRound.date).toLowerCase()}` : "No rounds scheduled",
                hint: "Applications currently in interview rounds",
                onClick: () => onNavigate("applications", "interviewing"),
              },
              {
                label: "Offers",
                tone: "offer",
                icon: IconTrophy,
                value: stats.offers,
                sub: stats.interviewed ? `From ${stats.interviewed} ${stats.interviewed === 1 ? "application" : "applications"} interviewed` : "None yet",
                hint: "Applications with an offer",
                onClick: () => onNavigate("applications", "offer"),
              },
              {
                label: "Response rate",
                tone: "accent",
                icon: IconTrendingUp,
                value: stats.responseRate === null ? "—" : `${stats.responseRate}%`,
                meter: stats.responseRate,
                sub: stats.submitted ? `${stats.heardBack} of ${stats.submitted} submitted heard back` : "Nothing submitted yet",
                hint: "Submitted applications that got any reply: an interview, offer or rejection",
              },
            ]}
          />

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-5 lg:gap-6">
            <AttentionCard items={attention} onNavigate={onNavigate} className={cx("lg:col-span-3", rise(5).className)} style={rise(5).style} />
            <AgendaCard upcoming={upcoming} onNavigate={onNavigate} className={cx("lg:col-span-2", rise(6).className)} style={rise(6).style} />
          </div>

          <PipelineCard onNavigate={onNavigate} growIn={entrance} className={rise(7).className} style={rise(7).style} />
        </div>
      )}
    </Page>
  );
}

// ---------- Headline numbers ----------

type StatTone = "applied" | "interviewing" | "offer" | "accent";

// Each tile borrows the color of what it counts, so the dashboard and board share one visual language.
const STAT_TONE: Record<StatTone, { chip: string; meter: string; glow: string }> = {
  applied: { chip: "bg-status-applied-soft text-status-applied-fg", meter: "bg-status-applied", glow: "from-status-applied-soft/70" },
  interviewing: { chip: "bg-status-interviewing-soft text-status-interviewing-fg", meter: "bg-status-interviewing", glow: "from-status-interviewing-soft/70" },
  offer: { chip: "bg-status-offer-soft text-status-offer-fg", meter: "bg-status-offer", glow: "from-status-offer-soft/70" },
  accent: { chip: "bg-accent-soft text-accent-fg", meter: "bg-accent", glow: "from-accent-soft/70" },
};

interface StatItem {
  label: string;
  value: number | string;
  sub: string;
  /** What the number counts, shown on hover and read to screen readers. */
  hint: string;
  tone: StatTone;
  icon: IconComponent;
  /** 0–100, drawn as a slim meter under the value. */
  meter?: number | null;
  onClick?: () => void;
}

function Stats({ items, rise, countUp }: { items: StatItem[]; rise: (i: number) => { className?: string; style?: CSSProperties }; countUp: boolean }) {
  // Meters start empty and fill to their real value once the cards have risen in.
  const filled = useMountedFrame(countUp);
  const entering = useEntering(countUp);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {items.map((item, i) => {
        const tone = STAT_TONE[item.tone];
        const body = (
          <>
            <span className={cx("pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b to-transparent", tone.glow)} aria-hidden="true" />
            <span className="relative flex items-center justify-between">
              <span className="text-ui font-medium text-fg-2">
                {item.label}
                <span className="sr-only">. {item.hint}.</span>
              </span>
              <span className={cx("flex size-7 items-center justify-center rounded-lg", tone.chip)}>
                <item.icon size={15} strokeWidth={2} />
              </span>
            </span>
            {/* Counting starts as the card arrives, not before it is visible. */}
            <StatValue value={item.value} countUp={countUp} delayMs={(i + 1) * 45 + 80} />
            {item.meter !== undefined && (
              <span className="relative mt-3 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <span
                  className={cx("block h-full rounded-full transition-[width] duration-700 ease-snappy", tone.meter)}
                  style={{ width: `${filled ? (item.meter ?? 0) : 0}%`, transitionDelay: entering ? "260ms" : undefined }}
                />
              </span>
            )}
            <span className="relative mt-auto line-clamp-2 block pt-2 text-xs text-fg-muted sm:truncate" title={item.sub}>
              {item.sub}
            </span>
          </>
        );
        const { className: riseClass, style } = rise(i + 1);
        const cls = cx("relative flex min-w-0 flex-col justify-start overflow-hidden rounded-card border border-line bg-surface p-4 text-left", riseClass);
        return item.onClick ? (
          <button key={item.label} type="button" title={item.hint} onClick={item.onClick} style={style} className={cx(cls, "lift hover:border-line-strong hover:shadow-card-hover")}>
            {body}
          </button>
        ) : (
          <div key={item.label} title={item.hint} style={style} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The headline number. On first visit it counts up from zero; afterwards a change settles in with a short
 * nudge. The animated digits are hidden from assistive tech, which reads the real value instead.
 */
function StatValue({ value, countUp, delayMs }: { value: number | string; countUp: boolean; delayMs: number }) {
  const match = typeof value === "number" ? null : /^(\d+)(%?)$/.exec(value);
  const numeric = typeof value === "number" ? value : match ? Number(match[1]) : null;
  const suffix = match?.[2] ?? "";
  const shown = useCountUp(numeric ?? 0, countUp && numeric !== null, delayMs);
  return (
    <span className="relative mt-2.5 block text-[28px] leading-none font-semibold tracking-[-0.03em] text-fg tabular-nums">
      <span aria-hidden="true">{numeric === null ? value : shown !== numeric ? `${shown}${suffix}` : <Ticker value={`${shown}${suffix}`} />}</span>
      <span className="sr-only">{value}</span>
    </span>
  );
}

// ---------- Section shell ----------

function Section({ title, count, action, children, className, style }: { title: string; count?: number; action?: React.ReactNode; children: React.ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <Card className={cx("flex flex-col", className)} style={style}>
      <div className="flex min-h-13 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 pt-3.5 pb-2.5">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-[-0.01em] text-fg">
          {title}
          {count !== undefined && (
            <span className="rounded-full bg-muted px-1.5 text-2xs font-medium text-fg-2">
              <Ticker value={count} />
            </span>
          )}
        </h2>
        {action && <div className="max-w-full min-w-0">{action}</div>}
      </div>
      {children}
    </Card>
  );
}

// ---------- Needs attention ----------

const ATTENTION_GROUPS: { value: AttentionGroup; label: string; icon: IconComponent }[] = [
  { value: "tasks", label: "Tasks", icon: IconTaskSquare },
  { value: "deadlines", label: "Deadlines", icon: IconFlag },
  { value: "interviews", label: "Interviews", icon: IconMessage },
  { value: "follow-ups", label: "Follow-ups", icon: IconMail },
];

const KIND_LABEL: Record<AttentionKind, string> = {
  "task-overdue": "Overdue task",
  "task-today": "Task",
  "deadline-passed": "Missed deadline",
  "deadline-soon": "Deadline",
  "interview-soon": "Interview prep",
  "stage-unlogged": "Log outcome",
  "follow-up": "Follow-up",
};

// Color only carries urgency; the icon carries the kind.
const SEVERITY_TEXT: Record<AttentionItem["severity"], string> = {
  danger: "text-danger-fg",
  warning: "text-warning-fg",
  info: "text-fg-muted",
};
const SEVERITY_TILE: Record<AttentionItem["severity"], string> = {
  danger: "bg-danger-soft text-danger-fg",
  warning: "bg-warning-soft text-warning-fg",
  info: "bg-muted text-fg-muted",
};

const ATTENTION_LIMIT = 5;

function AttentionCard({ items, onNavigate, className, style }: { items: AttentionItem[]; onNavigate: Navigate; className?: string; style?: CSSProperties }) {
  const { applications, setTaskDone, updateApplication, setStageCompleted } = useData();
  const { toast } = useFeedback();
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<AttentionGroup | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);

  const counts = new Map<AttentionGroup, number>();
  for (const item of items) counts.set(ATTENTION_GROUP[item.kind], (counts.get(ATTENTION_GROUP[item.kind]) ?? 0) + 1);
  const groups = ATTENTION_GROUPS.filter((g) => counts.has(g.value));
  // Resolving the last item of a kind drops its filter; fall back to everything.
  const active = filter !== "all" && counts.has(filter) ? filter : "all";
  const filtered = active === "all" ? items : items.filter((i) => ATTENTION_GROUP[i.kind] === active);
  const shown = expanded ? filtered : filtered.slice(0, ATTENTION_LIMIT);

  const run = async (item: AttentionItem, action: () => Promise<void>, done: string, undo: () => Promise<void>) => {
    setBusy(item.key);
    try {
      await action();
      toast(done, { action: { label: "Undo", onClick: () => undo().catch((e) => toast(`Couldn't undo: ${errorMessage(e)}`, { tone: "error" })) } });
    } catch (e) {
      toast(`Couldn't update: ${errorMessage(e)}`, { tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  const resolveAction = (item: AttentionItem): { label: string; onClick: () => void } | null => {
    if (item.taskId) {
      const id = item.taskId;
      return { label: "Done", onClick: () => run(item, () => setTaskDone(id, true), "Task completed", () => setTaskDone(id, false)) };
    }
    if (item.kind === "deadline-soon" && item.appId) {
      const app = applications.find((a) => a.id === item.appId);
      if (!app) return null;
      return {
        label: "Mark applied",
        onClick: () => run(item, () => updateApplication(app.id, { status: "applied" }), `${app.company} moved to Applied`, () => updateApplication(app.id, { status: "wishlist", appliedDate: app.appliedDate })),
      };
    }
    if (item.kind === "stage-unlogged" && item.stageId) {
      const id = item.stageId;
      return { label: "Mark done", onClick: () => run(item, () => setStageCompleted(id, true), "Round marked complete", () => setStageCompleted(id, false)) };
    }
    return null;
  };

  return (
    <Section
      title="Needs attention"
      count={items.length || undefined}
      className={className}
      style={style}
      action={
        groups.length > 1 && (
          <div className="-mx-1 overflow-x-auto px-1">
            <Segmented
              size="sm"
              label="Filter attention items"
              value={active}
              onChange={(v) => {
                setFilter(v);
                setExpanded(false);
              }}
              options={[{ value: "all" as const, label: "All" }, ...groups.map((g) => ({ value: g.value, label: `${g.label} ${counts.get(g.value)}` }))]}
            />
          </div>
        )
      }
    >
      {items.length === 0 ? (
        <EmptyState compact icon={IconCheckCircle} title="You're all caught up" description="Nothing overdue, due today or waiting on you." className="my-auto pb-10" />
      ) : (
        <>
          {/* Keyed by filter: switching filters swaps rows at once; resolving one lets it collapse out. */}
          <AttentionList key={active} items={shown} allKeys={new Set(items.map((i) => i.key))} busy={busy} resolveAction={resolveAction} onNavigate={onNavigate} />
          {filtered.length > ATTENTION_LIMIT && (
            <div className="mt-auto border-t border-line px-5 py-2.5">
              <LinkButton onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
                {expanded ? "Show fewer" : `Show ${filtered.length - ATTENTION_LIMIT} more`}
              </LinkButton>
            </div>
          )}
        </>
      )}
    </Section>
  );
}

function AttentionList({
  items,
  allKeys,
  busy,
  resolveAction,
  onNavigate,
}: {
  items: AttentionItem[];
  /** Every current item, including ones hidden by "Show fewer": a row missing from here was resolved. */
  allKeys: Set<string>;
  busy: string | null;
  resolveAction: (item: AttentionItem) => { label: string; onClick: () => void } | null;
  onNavigate: Navigate;
}) {
  const rows = usePresence(items, (i) => i.key);
  return (
    <ul className="px-2 pb-2">
      {rows.map(({ key, item, state }) => {
        const group = ATTENTION_GROUPS.find((g) => g.value === ATTENTION_GROUP[item.kind])!;
        const action = resolveAction(item);
        const canOpen = !!item.appId;
        const resolved = state === "exiting" && !allKeys.has(key);
        const body = (
          <>
            <span className={cx("flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors", resolved ? "bg-success-soft text-success-fg" : SEVERITY_TILE[item.severity])}>
              {resolved ? <IconCheck size={15} strokeWidth={2.25} className="animate-check-pop" /> : <group.icon size={15} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-fg">{item.title}</span>
              <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-fg-muted">
                <span className={cx("shrink-0 font-medium", SEVERITY_TEXT[item.severity])}>{item.when}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{[KIND_LABEL[item.kind], item.detail].filter(Boolean).join(" · ")}</span>
              </span>
            </span>
          </>
        );
        return (
          <PresenceRow key={key} state={state} className="group flex items-center gap-2 rounded-lg pr-2 transition-colors hover:bg-subtle">
            {canOpen ? (
              <button type="button" onClick={() => onNavigate("detail", item.appId)} className="tactile-soft flex min-w-0 flex-1 items-center gap-3 rounded-lg py-2 pl-3 text-left" aria-label={`${item.title}. ${item.when}. Open application`}>
                {body}
              </button>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-3 py-2 pl-3">{body}</div>
            )}
            {action ? (
              <Button size="sm" variant="secondary" icon={IconCheck} loading={busy === item.key} disabled={busy !== null && busy !== item.key} onClick={action.onClick} aria-label={`${action.label}: ${item.title}`} className="shrink-0">
                <span className="max-sm:sr-only">{action.label}</span>
              </Button>
            ) : (
              canOpen && <IconChevronRight size={16} className="mr-1 shrink-0 text-fg-faint transition-[color,translate] duration-200 ease-snappy group-hover:translate-x-0.5 group-hover:text-fg-muted" aria-hidden="true" />
            )}
          </PresenceRow>
        );
      })}
    </ul>
  );
}

// ---------- Agenda: upcoming + tasks ----------

function dayHeading(iso: string) {
  const d = daysUntil(iso);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return toDate(iso).toLocaleDateString("en-US", { weekday: "long" });
}

// Monochrome glyphs tinted by the calendar's kind colors, so the agenda and Calendar read the same.
const KIND_ICON: Record<ItemKind, { icon: IconComponent; text: string }> = {
  interview: { icon: IconMessage, text: "text-kind-interview" },
  deadline: { icon: IconFlag, text: "text-kind-deadline" },
  task: { icon: IconTaskSquare, text: "text-kind-task" },
  event: { icon: IconCalendar, text: "text-kind-event" },
};

function AgendaCard({ upcoming, onNavigate, className, style }: { upcoming: CalendarItem[]; onNavigate: Navigate; className?: string; style?: CSSProperties }) {
  const { tasks } = useData();
  const [tab, setTabState] = useState(lastAgendaTab);
  const setTab = (t: typeof tab) => {
    lastAgendaTab = t;
    setTabState(t);
  };
  const openTasks = tasks.filter((t) => !t.done).length;

  return (
    <Section
      title="Agenda"
      className={className}
      style={style}
      action={
        <Segmented
          size="sm"
          label="Agenda view"
          value={tab}
          onChange={setTab}
          options={[
            { value: "upcoming", label: "Upcoming" },
            {
              value: "tasks",
              label: openTasks ? (
                <>
                  Tasks · <Ticker value={openTasks} />
                </>
              ) : (
                "Tasks"
              ),
            },
          ]}
        />
      }
    >
      {tab === "upcoming" ? <UpcomingList items={upcoming} onNavigate={onNavigate} /> : <TasksPanel embedded />}
    </Section>
  );
}

const AGENDA_LIMIT = 5;

function UpcomingList({ items, onNavigate }: { items: CalendarItem[]; onNavigate: Navigate }) {
  const { applications } = useData();
  const shown = items.slice(0, AGENDA_LIMIT);
  // One flat list so finished items can collapse out; each day's heading rides on its first row.
  const rows = usePresence(shown, (i) => i.id);
  const companyOf = (id: string | null) => (id ? applications.find((a) => a.id === id)?.company ?? "" : "");
  const open = (item: CalendarItem) => {
    if (item.event) onNavigate("calendar", item.event.id);
    else if (item.applicationId) onNavigate("detail", item.applicationId);
    else onNavigate("calendar");
  };

  if (shown.length === 0) {
    return (
      <EmptyState
        compact
        icon={IconCalendar}
        title="Nothing in the next two weeks"
        description="Interviews, deadlines, dated tasks and events show up here."
        actions={
          <Button size="sm" onClick={() => onNavigate("calendar")}>
            Open Calendar
          </Button>
        }
        className="my-auto pb-10"
      />
    );
  }

  let lastLiveDate = "";
  let lastDate = "";
  return (
    <>
      <ul className="px-2 pb-2">
        {rows.map(({ key, item, state }, index) => {
          // A live row starts a day if the live row before it is on another day; a leaving row keeps the heading it had.
          const startsDay = state === "exiting" ? item.date !== lastDate : item.date !== lastLiveDate;
          lastDate = item.date;
          if (state !== "exiting") lastLiveDate = item.date;
          const kind = KIND_ICON[item.kind];
          // Tasks and events don't carry the role; show whichever context the item has.
          const context = item.kind === "interview" || item.kind === "deadline" ? item.detail : companyOf(item.applicationId);
          return (
            <PresenceRow key={key} state={state}>
              {startsDay && (
                <h3 className={cx("flex items-baseline gap-1.5 px-3 pb-0.5 text-xs", index > 0 && "pt-2.5")}>
                  <span className={cx("font-semibold", daysUntil(item.date) === 0 ? "text-accent-fg" : "text-fg-2")}>{dayHeading(item.date)}</span>
                  <span className="text-fg-muted">{formatDate(item.date)}</span>
                </h3>
              )}
              <button type="button" onClick={() => open(item)} className="tactile-soft flex w-full items-start gap-3 rounded-lg px-3 py-1.5 text-left hover:bg-subtle">
                <kind.icon size={15} className={cx("mt-0.5", kind.text)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-fg">{item.label}</span>
                  <span className="block truncate text-xs text-fg-muted">{[KIND_META[item.kind].label, context].filter(Boolean).join(" · ")}</span>
                </span>
                {item.time && <span className="mt-0.5 shrink-0 text-xs text-fg-2 tabular-nums">{formatTime(item.time)}</span>}
              </button>
            </PresenceRow>
          );
        })}
      </ul>
      <div className="mt-auto border-t border-line px-5 py-2.5">
        <LinkButton onClick={() => onNavigate("calendar")}>
          {items.length > shown.length ? `${items.length - shown.length} more in the next two weeks` : "Open Calendar"} <IconArrowRight size={14} className="transition-transform duration-200 ease-snappy group-hover:translate-x-0.5" />
        </LinkButton>
      </div>
    </>
  );
}

function sortTasks(tasks: Task[]) {
  // Dated tasks first (soonest first), then undated ones.
  return [...tasks].sort((a, b) => (a.due ? 0 : 1) - (b.due ? 0 : 1) || a.due.localeCompare(b.due) || a.text.localeCompare(b.text));
}

function TasksPanel({ embedded }: { embedded?: boolean }) {
  const { applications, tasks, addTask, setTaskDone, deleteTask } = useData();
  const { toast } = useFeedback();
  const [draft, setDraft] = useState<{ text: string; due: string; applicationId: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const open = sortTasks(tasks.filter((t) => !t.done));
  const done = tasks.filter((t) => t.done);

  const save = async () => {
    if (!draft?.text.trim()) return;
    setSaving(true);
    try {
      await addTask({ text: draft.text, due: draft.due, applicationId: draft.applicationId || null });
      setDraft({ text: "", due: "", applicationId: draft.applicationId });
    } catch (e) {
      toast(`Couldn't add task: ${errorMessage(e)}`, { tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  // Tick immediately; the row leaves the open list once the save lands (it doesn't wait on the animation).
  const [flipping, setFlipping] = useState<Set<string>>(new Set());
  // Leaving rows hold the snapshot from before the change, so read the task's latest state by id.
  const shownDone = (task: Task) => (tasks.find((t) => t.id === task.id) ?? task).done !== flipping.has(task.id);
  const toggle = (task: Task) => {
    setFlipping((s) => new Set(s).add(task.id));
    setTaskDone(task.id, !task.done)
      .catch((e) => toast(`Couldn't update task: ${errorMessage(e)}`, { tone: "error" }))
      .finally(() =>
        setFlipping((s) => {
          const next = new Set(s);
          next.delete(task.id);
          return next;
        }),
      );
  };
  const openRows = usePresence(open, (t) => t.id);
  const doneRows = usePresence(done, (t) => t.id);

  const remove = async (task: Task) => {
    try {
      await deleteTask(task.id);
      toast("Task deleted", {
        tone: "info",
        action: {
          label: "Undo",
          onClick: () =>
            addTask({ text: task.text, due: task.due, applicationId: task.applicationId })
              .then((id) => (task.done ? setTaskDone(id, true) : undefined))
              .catch((e) => toast(`Couldn't restore task: ${errorMessage(e)}`, { tone: "error" })),
        },
      });
    } catch (e) {
      toast(`Couldn't delete task: ${errorMessage(e)}`, { tone: "error" });
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      {!embedded && (
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h2 className="text-base font-semibold tracking-[-0.01em] text-fg">Tasks</h2>
        </div>
      )}

      {draft ? (
        <form
          className="mx-3 mb-2 space-y-2 rounded-lg border border-line bg-subtle p-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setDraft(null);
            }
          }}
        >
          <Input autoFocus aria-label="Task" placeholder="e.g. Send thank-you note to recruiter" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
          <div className="flex gap-2">
            <Select aria-label="Related application" wrapperClassName="min-w-0 flex-1" value={draft.applicationId} onChange={(e) => setDraft({ ...draft, applicationId: e.target.value })}>
              <option value="">No application</option>
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.company} · {a.position}
                </option>
              ))}
            </Select>
            <Input aria-label="Due date" type="date" className="w-36" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              Done
            </Button>
            <Button size="sm" variant="primary" type="submit" loading={saving} disabled={!draft.text.trim()}>
              Add task
            </Button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setDraft({ text: "", due: "", applicationId: "" })}
          className="mx-2 mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-fg-muted transition-colors hover:bg-subtle hover:text-fg"
        >
          <IconPlus size={16} />
          Add task
        </button>
      )}

      {openRows.length === 0 ? (
        !draft && <p className="px-5 pt-2 pb-6 text-ui text-fg-muted">{done.length ? "Every task is done." : "Follow-ups and prep with a due date also appear on your calendar."}</p>
      ) : (
        <ul className="px-2 pb-2">
          {openRows.map(({ key, item: task, state }) => (
            <PresenceRow key={key} state={state}>
              <TaskRow task={task} done={shownDone(task)} onToggle={() => toggle(task)} onDelete={() => remove(task)} />
            </PresenceRow>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <div className="mt-auto border-t border-line px-2 py-2">
          <button type="button" onClick={() => setShowDone((s) => !s)} className="flex w-full items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium text-fg-muted hover:text-fg" aria-expanded={showDone}>
            <IconChevronRight size={14} className={cx("transition-transform", showDone && "rotate-90")} />
            Completed ({done.length})
          </button>
          {showDone && (
            <ul className="mt-1">
              {doneRows.map(({ key, item: task, state }) => (
                <PresenceRow key={key} state={state}>
                  <TaskRow task={task} done={shownDone(task)} onToggle={() => toggle(task)} onDelete={() => remove(task)} />
                </PresenceRow>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, done, onToggle, onDelete }: { task: Task; done: boolean; onToggle: () => void; onDelete: () => void }) {
  return (
    <div className="group flex items-start gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-subtle">
      <Checkbox checked={done} onChange={onToggle} aria-label={done ? `Mark "${task.text}" as not done` : `Mark "${task.text}" as done`} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        {/* The strike is always there, just transparent until done, so it fades in rather than popping. */}
        <p className={cx("text-sm leading-snug line-through transition-[color,text-decoration-color] duration-200", done ? "text-fg-muted decoration-fg-muted" : "text-fg decoration-transparent")}>{task.text}</p>
        {(task.company || task.due) && (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-fg-muted">
            {task.company && <span className="truncate">{task.company}</span>}
            {task.company && task.due && <span aria-hidden="true">·</span>}
            {task.due && (done ? <span>{formatDate(task.due)}</span> : <DueChip date={task.due} prefix="Due" />)}
          </p>
        )}
      </div>
      <IconButton icon={IconTrash} size="sm" label={`Delete "${task.text}"`} onClick={onDelete} className="-my-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-lg:opacity-100" />
    </div>
  );
}

// ---------- Pipeline: one view at a time ----------

/** Below this many submissions a single reply swings the rates by 20+ points, so we say so. */
const SMALL_SAMPLE = 5;

function PipelineCard({ onNavigate, growIn, className, style }: { onNavigate: Navigate; growIn: boolean; className?: string; style?: CSSProperties }) {
  const { applications, recentActivity } = useData();
  const stats = useMemo(() => pipelineStats(applications), [applications]);
  const weeks = useMemo(() => weeklySubmissions(applications, 12), [applications]);
  const [tab, setTabState] = useState(lastPipelineTab);
  // Bars grow in with the dashboard's first entrance only, not on every tab switch.
  const [grow, setGrow] = useState(growIn);
  const setTab = (t: typeof tab) => {
    lastPipelineTab = t;
    setTabState(t);
    setGrow(false);
  };

  return (
    <Section
      title="Pipeline"
      className={className}
      style={style}
      action={
        <div className="-mx-1 overflow-x-auto px-1">
          <Segmented
            size="sm"
            label="Pipeline view"
            value={tab}
            onChange={setTab}
            options={[
              { value: "overview", label: "Overview" },
              { value: "weekly", label: "Weekly" },
              { value: "activity", label: "Activity" },
            ]}
          />
        </div>
      }
    >
      <div className="px-5 pt-1 pb-5">
        {tab === "overview" && (
          <div className="grid gap-6 min-[1400px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] min-[1400px]:gap-8">
            <div>
              <SubHeading title="By stage" note={`${stats.total} tracked · select a stage to filter`} />
              <StageBreakdown applications={applications} onSelect={(s) => onNavigate("applications", s)} growIn={grow} />
            </div>
            <div className="border-line max-[1400px]:border-t max-[1400px]:pt-5 min-[1400px]:border-l min-[1400px]:pl-8">
              <SubHeading title="Conversion" />
              {stats.submitted === 0 ? (
                <p className="text-ui text-fg-muted">Rates appear once you've moved an application past Wishlist.</p>
              ) : (
                <>
                  <ConversionSteps
                    growIn={grow}
                    steps={[
                      { label: "Submitted", value: stats.submitted },
                      { label: "Heard back", value: stats.heardBack },
                      { label: "Interviewed", value: stats.interviewed },
                      { label: "Offer", value: stats.offers },
                    ]}
                  />
                  <p className="mt-4 text-xs text-fg-muted">
                    Each rate is the share of the step before it.
                    {stats.submitted < SMALL_SAMPLE && " With only a few submissions, expect these to move a lot."}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
        {tab === "weekly" && (
<WeeklyColumns weeks={weeks} title="Submissions per week" />
        )}
        {tab === "activity" &&
          (recentActivity.length === 0 ? <p className="text-ui text-fg-muted">Changes to your applications show up here.</p> : <ActivityList items={recentActivity} onNavigate={onNavigate} />)}
      </div>
    </Section>
  );
}

function SubHeading({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
      <h3 className="text-xs font-semibold text-fg-2">{title}</h3>
      {note && <p className="text-xs text-fg-muted">{note}</p>}
    </div>
  );
}

const ACTIVITY_DOT: Record<ActivityItem["icon"], string> = {
  offer: "bg-status-offer",
  rejected: "bg-status-rejected",
  interview: "bg-status-interviewing",
  added: "bg-line-strong",
  status: "bg-status-applied",
};

function ActivityList({ items, onNavigate }: { items: ActivityItem[]; onNavigate: Navigate }) {
  return (
    <ul className="-mx-3">
      {items.map((item) => (
        <li key={item.id}>
          <button type="button" onClick={() => onNavigate("detail", item.id)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-subtle">
            <span className={cx("size-1.5 shrink-0 rounded-full", ACTIVITY_DOT[item.icon])} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-sm text-fg">{item.text}</span>
            <span className="shrink-0 text-xs text-fg-muted">{item.time}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ---------- Empty account ----------

function GettingStarted({ onNavigate }: { onNavigate: Navigate }) {
  const options: { icon: IconComponent; title: string; text: string; onClick: () => void }[] = [
    { icon: IconPlus, title: "Add an application", text: "Company, role, deadline. About ten seconds.", onClick: () => onNavigate("add") },
    { icon: IconUpload, title: "Import a spreadsheet", text: "Bring an existing tracker in from a CSV.", onClick: () => onNavigate("applications") },
    { icon: IconBriefcase, title: "Find openings", text: "Browse listings or get resume matches.", onClick: () => onNavigate("jobs") },
  ];
  return (
    <Section title="Start tracking your search" className="lg:col-span-2">
      <p className="-mt-1 px-5 pb-4 text-ui text-fg-muted">Once you add applications, this page shows what needs attention, what's coming up and how your search is going.</p>
      <div className="grid gap-3 px-5 pb-5 sm:grid-cols-3">
        {options.map((opt) => (
          <button key={opt.title} type="button" onClick={opt.onClick} className="lift group flex flex-col items-start rounded-lg border border-line p-4 text-left hover:border-line-strong hover:shadow-card-hover">
            <span className="mb-3 flex size-8 items-center justify-center rounded-md bg-muted text-fg-2 transition-colors group-hover:bg-accent-soft group-hover:text-accent-fg">
              <opt.icon size={16} />
            </span>
            <span className="text-ui font-medium text-fg">{opt.title}</span>
            <span className="mt-0.5 text-xs text-fg-muted">{opt.text}</span>
          </button>
        ))}
      </div>
    </Section>
  );
}
