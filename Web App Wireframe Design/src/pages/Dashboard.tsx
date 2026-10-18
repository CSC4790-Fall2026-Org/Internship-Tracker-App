import { useMemo, useState } from "react";
import { useData, type ActivityItem } from "../data/DataContext";
import type { Task } from "../data/types";
import { addDaysISO, daysUntil, formatDate, formatTime, todayISO } from "../data/dates";
import { attentionItems, KIND_META, pipelineStats, upcomingItems, weeklySubmissions, type AttentionItem, type CalendarItem } from "../data/insights";
import { Button, Card, CardHeader, Checkbox, cx, DueChip, EmptyState, IconButton, Input, LinkButton, Page, PageHeader, Select } from "../components/ui";
import { ConversionFunnel, StatusDistribution, WeeklyColumns } from "../components/charts";
import { useFeedback, errorMessage } from "../components/feedback";
import {
  IconAlertCircle,
  IconArrowRight,
  IconBriefcase,
  IconCalendar,
  IconCheck,
  IconCheckCircle,
  IconChevronRight,
  IconClock,
  IconInbox,
  IconMessage,
  IconPlus,
  IconSend,
  IconTaskSquare,
  IconTrash,
  IconUpload,
  IconX,
  type IconComponent,
} from "../components/icons";

interface DashboardProps {
  onNavigate: (screen: string, id?: string) => void;
  userName: string;
}

export default function Dashboard({ onNavigate, userName }: DashboardProps) {
  const { applications, tasks, events, recentActivity } = useData();
  const stats = useMemo(() => pipelineStats(applications), [applications]);
  const attention = useMemo(() => attentionItems(applications, tasks), [applications, tasks]);
  const upcoming = useMemo(() => upcomingItems(applications, tasks, events, 14), [applications, tasks, events]);
  const weeks = useMemo(() => weeklySubmissions(applications, 12), [applications]);

  const today = todayISO();
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const firstName = userName.split(" ")[0];

  const weekAgo = addDaysISO(-6);
  const appliedThisWeek = applications.filter((a) => a.appliedDate && a.appliedDate >= weekAgo && a.appliedDate <= today).length;
  const upcomingRounds = applications.flatMap((a) => a.interviewStages.filter((s) => !s.completed && s.date && s.date >= today));
  const nextInterview = upcoming.find((i) => i.kind === "interview");

  const summary =
    applications.length === 0
      ? "Let's get your search organized."
      : [
          attention.length > 0 ? `${attention.length} ${attention.length === 1 ? "thing needs" : "things need"} your attention` : "You're all caught up",
          nextInterview ? `next interview ${daysUntil(nextInterview.date) === 0 ? "today" : formatDate(nextInterview.date, { weekday: true })}` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <Page>
      <PageHeader
        eyebrow={now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        title={`${greeting}, ${firstName}`}
        description={summary.charAt(0).toUpperCase() + summary.slice(1)}
        actions={
          <Button variant="primary" icon={IconPlus} onClick={() => onNavigate("add")}>
            Add application
          </Button>
        }
      />

      {applications.length === 0 ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <GettingStarted onNavigate={onNavigate} />
          <TasksCard />
        </div>
      ) : (
        <>
          <KpiStrip
            items={[
              { label: "Tracked", value: stats.total, sub: appliedThisWeek ? `${appliedThisWeek} applied this week` : "None applied this week", onClick: () => onNavigate("applications") },
              { label: "In progress", value: stats.active, sub: `${stats.awaiting} awaiting a reply`, onClick: () => onNavigate("pipeline") },
              { label: "Interviewing", value: stats.interviewing, sub: upcomingRounds.length ? `${upcomingRounds.length} upcoming ${upcomingRounds.length === 1 ? "round" : "rounds"}` : "No rounds scheduled", onClick: () => onNavigate("applications", "interviewing") },
              { label: "Offers", value: stats.offers, sub: stats.offerRate !== null ? `${stats.offerRate}% of interviews` : "None yet", onClick: () => onNavigate("applications", "offer") },
              { label: "Response rate", value: stats.responseRate === null ? "—" : `${stats.responseRate}%`, sub: stats.submitted ? `${stats.heardBack} of ${stats.submitted} heard back` : "Nothing submitted yet" },
            ]}
          />

          {/* Two columns on desktop; on narrower screens the columns dissolve so today's schedule comes before the charts. */}
          <div className="mt-5 grid items-start gap-5 lg:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-5 max-lg:contents lg:col-span-2">
              <div className="min-w-0 max-lg:order-1">
                <AttentionCard items={attention} onNavigate={onNavigate} />
              </div>
              <div className="min-w-0 max-lg:order-4">
                <PipelineCard onNavigate={onNavigate} stats={stats} weeks={weeks} />
              </div>
              <div className="min-w-0 max-lg:order-5">
                <ActivityCard items={recentActivity} onNavigate={onNavigate} />
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-5 max-lg:contents">
              <div className="min-w-0 max-lg:order-2">
                <UpNextCard items={upcoming} onNavigate={onNavigate} />
              </div>
              <div className="min-w-0 max-lg:order-3">
                <TasksCard />
              </div>
            </div>
          </div>
        </>
      )}
    </Page>
  );
}

// ---------- KPI strip ----------

function KpiStrip({ items }: { items: { label: string; value: number | string; sub: string; onClick?: () => void }[] }) {
  return (
    // The 1px gaps over a line-colored background draw the dividers, whatever the column count.
    <Card className="grid grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item, i) => {
        const body = (
          <>
            <span className="text-ui text-fg-muted">{item.label}</span>
            <span className="mt-1.5 block text-2xl font-semibold tracking-[-0.02em] text-fg">{item.value}</span>
            <span className="mt-0.5 block truncate text-xs text-fg-muted">{item.sub}</span>
          </>
        );
        // The last tile widens to fill the final row on two- and three-column layouts.
        const cls = cx("block min-w-0 bg-surface px-4 py-3.5 text-left", i === items.length - 1 && "col-span-2 lg:col-span-1");
        return item.onClick ? (
          <button key={item.label} type="button" onClick={item.onClick} className={cx(cls, "transition-colors hover:bg-subtle")}>
            {body}
          </button>
        ) : (
          <div key={item.label} className={cls}>
            {body}
          </div>
        );
      })}
    </Card>
  );
}

// ---------- Needs attention ----------

const ATTENTION_ICON: Record<AttentionItem["kind"], IconComponent> = {
  "task-overdue": IconTaskSquare,
  "deadline-passed": IconAlertCircle,
  "deadline-soon": IconClock,
  "interview-soon": IconMessage,
  "stage-unlogged": IconMessage,
  "follow-up": IconSend,
};

function AttentionCard({ items, onNavigate }: { items: AttentionItem[]; onNavigate: (screen: string, id?: string) => void }) {
  const { setTaskDone } = useData();
  const { toast } = useFeedback();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, 5);

  return (
    <Card>
      <CardHeader icon={IconInbox} title="Needs attention" description={items.length ? "Overdue tasks, closing deadlines, and applications that have gone quiet" : undefined} />
      {items.length === 0 ? (
        <EmptyState compact icon={IconCheckCircle} title="You're all caught up" description="No overdue tasks, closing deadlines or stale applications right now." className="pt-2" />
      ) : (
        <ul className="border-t border-line">
          {shown.map((item) => {
            const Icon = ATTENTION_ICON[item.kind];
            return (
              <li key={item.key} className="group flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
                <span
                  className={cx(
                    "flex size-7 shrink-0 items-center justify-center rounded-md",
                    item.severity === "danger" ? "bg-danger-soft text-danger-fg" : item.severity === "warning" ? "bg-warning-soft text-warning-fg" : "bg-muted text-fg-muted",
                  )}
                >
                  <Icon size={15} />
                </span>
                <button type="button" disabled={!item.appId} onClick={() => item.appId && onNavigate("detail", item.appId)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-ui font-medium text-fg">{item.title}</span>
                  <span className="block truncate text-xs text-fg-muted">{item.detail}</span>
                </button>
                {item.taskId ? (
                  <Button
                    size="sm"
                    icon={IconCheck}
                    onClick={() =>
                      setTaskDone(item.taskId!, true)
                        .then(() => toast("Task completed"))
                        .catch((e) => toast(`Couldn't update task: ${errorMessage(e)}`, { tone: "error" }))
                    }
                  >
                    Done
                  </Button>
                ) : (
                  item.appId && <IconChevronRight size={16} className="text-fg-faint transition-colors group-hover:text-fg-muted" />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {items.length > 5 && (
        <div className="border-t border-line px-4 py-2">
          <LinkButton onClick={() => setExpanded((e) => !e)}>{expanded ? "Show fewer" : `Show all ${items.length}`}</LinkButton>
        </div>
      )}
    </Card>
  );
}

// ---------- Pipeline ----------

function PipelineCard({ onNavigate, stats, weeks }: { onNavigate: (screen: string, id?: string) => void; stats: ReturnType<typeof pipelineStats>; weeks: { label: string; count: number }[] }) {
  const { applications } = useData();
  const recent = weeks.reduce((n, w) => n + w.count, 0);
  return (
    <Card>
      <CardHeader
        title="Pipeline"
        description={`${stats.total} tracked · ${stats.submitted} submitted`}
        action={
          <LinkButton onClick={() => onNavigate("pipeline")}>
            Open board <IconArrowRight size={14} />
          </LinkButton>
        }
      />
      <div className="px-4 pb-4">
        <StatusDistribution applications={applications} onSelect={(s) => onNavigate("applications", s)} />
      </div>
      <div className="grid border-t border-line sm:grid-cols-2">
        <div className="p-4 sm:border-r sm:border-line">
          <p className="mb-3 text-ui font-medium text-fg">Conversion</p>
          {stats.submitted === 0 ? (
            <p className="text-ui text-fg-muted">Conversion appears once you've submitted an application.</p>
          ) : (
            <ConversionFunnel
              steps={[
                { label: "Submitted", value: stats.submitted },
                { label: "Heard back", value: stats.heardBack },
                { label: "Interviewed", value: stats.interviewed },
                { label: "Offer", value: stats.offers },
              ]}
            />
          )}
        </div>
        <div className="border-t border-line p-4 sm:border-t-0">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <p className="text-ui font-medium text-fg">Applications per week</p>
            <p className="text-xs text-fg-muted tabular-nums">{recent} in 12 weeks</p>
          </div>
          <WeeklyColumns weeks={weeks} />
        </div>
      </div>
    </Card>
  );
}

// ---------- Up next ----------

function dayHeading(iso: string) {
  const d = daysUntil(iso);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return formatDate(iso, { weekday: true });
}

function UpNextCard({ items, onNavigate }: { items: CalendarItem[]; onNavigate: (screen: string, id?: string) => void }) {
  const shown = items.slice(0, 7);
  const groups: { date: string; items: CalendarItem[] }[] = [];
  for (const item of shown) {
    const last = groups[groups.length - 1];
    if (last?.date === item.date) last.items.push(item);
    else groups.push({ date: item.date, items: [item] });
  }

  const open = (item: CalendarItem) => {
    if (item.event) onNavigate("calendar", item.event.id);
    else if (item.applicationId) onNavigate("detail", item.applicationId);
    else onNavigate("calendar");
  };

  return (
    <Card>
      <CardHeader
        icon={IconCalendar}
        title="Up next"
        description="The next two weeks"
        action={
          <LinkButton onClick={() => onNavigate("calendar")}>
            Calendar <IconArrowRight size={14} />
          </LinkButton>
        }
      />
      {groups.length === 0 ? (
        <EmptyState compact title="Nothing scheduled" description="Interviews, deadlines and events you add will show up here." className="pt-1" />
      ) : (
        <div className="space-y-3 px-2 pb-3">
          {groups.map((group) => (
            <div key={group.date}>
              <p className={cx("px-2 pb-1 text-xs font-medium", daysUntil(group.date) === 0 ? "text-accent-fg" : "text-fg-muted")}>{dayHeading(group.date)}</p>
              <ul>
                {group.items.map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => open(item)} className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted">
                      <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", KIND_META[item.kind].dot)} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-ui text-fg">{item.label}</span>
                        <span className="block truncate text-xs text-fg-muted">
                          {KIND_META[item.kind].label}
                          {item.time && ` · ${formatTime(item.time)}`}
                          {item.detail && item.kind !== "event" && ` · ${item.detail}`}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {items.length > shown.length && (
            <div className="px-2">
              <LinkButton onClick={() => onNavigate("calendar")}>{items.length - shown.length} more in the calendar</LinkButton>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ---------- Tasks ----------

function sortTasks(tasks: Task[]) {
  // Open tasks with a due date first (soonest first), then undated ones.
  return [...tasks].sort((a, b) => (a.due ? 0 : 1) - (b.due ? 0 : 1) || a.due.localeCompare(b.due) || a.text.localeCompare(b.text));
}

function TasksCard() {
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

  const toggle = (task: Task) =>
    setTaskDone(task.id, !task.done).catch((e) => toast(`Couldn't update task: ${errorMessage(e)}`, { tone: "error" }));

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
    <Card>
      <CardHeader
        icon={IconTaskSquare}
        title="Tasks"
        description={open.length ? `${open.length} open` : undefined}
        action={!draft && <IconButton icon={IconPlus} size="sm" label="Add task" onClick={() => setDraft({ text: "", due: "", applicationId: "" })} />}
      />

      {draft && (
        <form
          className="mx-3 mb-3 space-y-2 rounded-lg border border-line bg-subtle p-2.5"
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
      )}

      {open.length === 0 && !draft ? (
        <EmptyState
          compact
          title={done.length ? "All tasks done" : "No tasks yet"}
          description="Follow-ups, thank-you notes, prep: anything with a due date shows on your calendar."
          actions={
            <Button size="sm" icon={IconPlus} onClick={() => setDraft({ text: "", due: "", applicationId: "" })}>
              Add a task
            </Button>
          }
          className="pt-1"
        />
      ) : (
        <ul className="px-2 pb-2">
          {open.map((task) => (
            <TaskRow key={task.id} task={task} onToggle={() => toggle(task)} onDelete={() => remove(task)} />
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <div className="border-t border-line px-2 py-2">
          <button type="button" onClick={() => setShowDone((s) => !s)} className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-fg-muted hover:text-fg" aria-expanded={showDone}>
            <IconChevronRight size={14} className={cx("transition-transform", showDone && "rotate-90")} />
            Completed ({done.length})
          </button>
          {showDone && (
            <ul className="mt-1">
              {done.map((task) => (
                <TaskRow key={task.id} task={task} onToggle={() => toggle(task)} onDelete={() => remove(task)} />
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

function TaskRow({ task, onToggle, onDelete }: { task: Task; onToggle: () => void; onDelete: () => void }) {
  return (
    <li className="group flex items-start gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60">
      <Checkbox checked={task.done} onChange={onToggle} aria-label={task.done ? `Mark "${task.text}" as not done` : `Mark "${task.text}" as done`} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className={cx("text-ui leading-snug", task.done ? "text-fg-muted line-through" : "text-fg")}>{task.text}</p>
        {(task.company || task.due) && (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-fg-muted">
            {task.company && <span className="truncate">{task.company}</span>}
            {task.company && task.due && <span aria-hidden="true">·</span>}
            {task.due && (task.done ? <span>{formatDate(task.due)}</span> : <DueChip date={task.due} prefix="Due" />)}
          </p>
        )}
      </div>
      <IconButton icon={IconTrash} size="sm" label={`Delete "${task.text}"`} onClick={onDelete} className="-my-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-lg:opacity-100" />
    </li>
  );
}

// ---------- Activity ----------

const ACTIVITY_ICON: Record<ActivityItem["icon"], { icon: IconComponent; cls: string }> = {
  offer: { icon: IconCheckCircle, cls: "bg-status-offer-soft text-status-offer-fg" },
  rejected: { icon: IconX, cls: "bg-status-rejected-soft text-status-rejected-fg" },
  interview: { icon: IconMessage, cls: "bg-status-interviewing-soft text-status-interviewing-fg" },
  added: { icon: IconPlus, cls: "bg-muted text-fg-muted" },
  status: { icon: IconArrowRight, cls: "bg-status-applied-soft text-status-applied-fg" },
};

function ActivityCard({ items, onNavigate }: { items: ActivityItem[]; onNavigate: (screen: string, id?: string) => void }) {
  return (
    <Card>
      <CardHeader title="Recent activity" />
      <ul className="px-2 pb-2">
        {items.map((item) => {
          const meta = ACTIVITY_ICON[item.icon];
          return (
            <li key={item.id}>
              <button type="button" onClick={() => onNavigate("detail", item.id)} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted">
                <span className={cx("flex size-6 shrink-0 items-center justify-center rounded-full", meta.cls)}>
                  <meta.icon size={13} strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1 truncate text-ui text-fg">{item.text}</span>
                <span className="shrink-0 text-xs text-fg-muted">{item.time}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ---------- Empty account ----------

function GettingStarted({ onNavigate }: { onNavigate: (screen: string, id?: string) => void }) {
  const options: { icon: IconComponent; title: string; text: string; onClick: () => void }[] = [
    { icon: IconPlus, title: "Add an application", text: "Company, role, deadline. Takes about ten seconds.", onClick: () => onNavigate("add") },
    { icon: IconUpload, title: "Import a spreadsheet", text: "Bring an existing tracker in from a CSV file.", onClick: () => onNavigate("applications") },
    { icon: IconBriefcase, title: "Find openings", text: "Browse listings or get matches from your resume.", onClick: () => onNavigate("jobs") },
  ];
  return (
    <Card className="lg:col-span-2">
      <CardHeader title="Start tracking your search" description="Once you add applications, this page shows what needs attention, upcoming interviews and how your pipeline is converting." />
      <div className="grid gap-3 px-4 pb-4 sm:grid-cols-3">
        {options.map((opt) => (
          <button key={opt.title} type="button" onClick={opt.onClick} className="group flex flex-col items-start rounded-lg border border-line p-3.5 text-left transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-card-hover">
            <span className="mb-3 flex size-8 items-center justify-center rounded-md bg-muted text-fg-2 transition-colors group-hover:bg-accent-soft group-hover:text-accent-fg">
              <opt.icon size={16} />
            </span>
            <span className="text-ui font-medium text-fg">{opt.title}</span>
            <span className="mt-0.5 text-xs text-fg-muted">{opt.text}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}
