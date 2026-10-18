import { useMemo, useState } from "react";
import { useData, type ActivityItem } from "../data/DataContext";
import type { Task } from "../data/types";
import { addDaysISO, daysUntil, formatDate, formatTime, todayISO } from "../data/dates";
import { attentionItems, KIND_META, pipelineStats, upcomingItems, weeklySubmissions, type AttentionItem, type CalendarItem } from "../data/insights";
import { Button, Card, Checkbox, cx, DueChip, EmptyState, IconButton, Input, LinkButton, Page, Segmented, Select } from "../components/ui";
import { ConversionFunnel, StatusDistribution, WeeklyColumns } from "../components/charts";
import { useFeedback, errorMessage } from "../components/feedback";
import { IconArrowRight, IconBriefcase, IconCheck, IconCheckCircle, IconChevronRight, IconPlus, IconTrash, IconUpload, type IconComponent } from "../components/icons";

interface DashboardProps {
  onNavigate: (screen: string, id?: string) => void;
  userName: string;
}

type Navigate = DashboardProps["onNavigate"];

// Remembered for the session so the dashboard reopens on the view you last chose.
let lastAgendaTab: "upcoming" | "tasks" = "upcoming";
let lastPipelineTab: "stages" | "conversion" | "weekly" | "activity" = "stages";

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

  const weekAgo = addDaysISO(-6);
  const appliedThisWeek = applications.filter((a) => a.appliedDate && a.appliedDate >= weekAgo && a.appliedDate <= today).length;
  const upcomingRounds = applications.flatMap((a) => a.interviewStages.filter((s) => !s.completed && s.date && s.date >= today)).length;

  const summary =
    applications.length === 0
      ? "Let's get your search organized."
      : attention.length > 0
        ? `${attention.length} ${attention.length === 1 ? "thing needs" : "things need"} your attention today.`
        : "You're all caught up.";

  return (
    <Page width="medium">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 lg:mb-10">
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
          <Card className="p-1">
            <TasksPanel />
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <Stats
            items={[
              { label: "In progress", value: stats.active, sub: appliedThisWeek ? `${appliedThisWeek} applied this week` : `${stats.total} tracked in total`, onClick: () => onNavigate("pipeline") },
              { label: "Interviewing", value: stats.interviewing, sub: upcomingRounds ? `${upcomingRounds} upcoming ${upcomingRounds === 1 ? "round" : "rounds"}` : "None scheduled", onClick: () => onNavigate("applications", "interviewing") },
              { label: "Offers", value: stats.offers, sub: stats.offers ? "Congratulations" : "Not yet", onClick: () => onNavigate("applications", "offer") },
              { label: "Response rate", value: stats.responseRate === null ? "—" : `${stats.responseRate}%`, sub: stats.submitted ? `${stats.heardBack} of ${stats.submitted} heard back` : "Nothing submitted yet" },
            ]}
          />

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
            <AttentionCard items={attention} onNavigate={onNavigate} className="lg:col-span-3" />
            <AgendaCard upcoming={upcoming} onNavigate={onNavigate} className="lg:col-span-2" />
          </div>

          <PipelineCard onNavigate={onNavigate} />
        </div>
      )}
    </Page>
  );
}

// ---------- Headline numbers ----------

/** Large, borderless figures: the numbers are the design, so they get no boxes. */
function Stats({ items }: { items: { label: string; value: number | string; sub: string; onClick?: () => void }[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-6 rounded-card border border-line bg-surface px-5 py-5 sm:grid-cols-4 sm:px-6">
      {items.map((item) => {
        const body = (
          <>
            <span className="block text-ui text-fg-muted">{item.label}</span>
            <span className="mt-1 block text-[30px] leading-none font-semibold tracking-[-0.03em] text-fg">{item.value}</span>
            <span className="mt-2 block truncate text-xs text-fg-muted">{item.sub}</span>
          </>
        );
        return item.onClick ? (
          <button key={item.label} type="button" onClick={item.onClick} className="-m-2 min-w-0 rounded-lg p-2 text-left transition-colors hover:bg-subtle">
            {body}
          </button>
        ) : (
          <div key={item.label} className="min-w-0">
            {body}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Section shell ----------

function Section({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cx("flex flex-col", className)}>
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 pt-4 pb-3">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{title}</h2>
        {action && <div className="max-w-full min-w-0">{action}</div>}
      </div>
      {children}
    </Card>
  );
}

// ---------- Needs attention ----------

const SEVERITY_DOT: Record<AttentionItem["severity"], string> = {
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-line-strong",
};

function AttentionCard({ items, onNavigate, className }: { items: AttentionItem[]; onNavigate: Navigate; className?: string }) {
  const { setTaskDone } = useData();
  const { toast } = useFeedback();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, 5);

  return (
    <Section title="Needs attention" className={className} action={items.length > 0 && <span className="text-ui text-fg-muted tabular-nums">{items.length}</span>}>
      {items.length === 0 ? (
        <EmptyState compact icon={IconCheckCircle} title="You're all caught up" description="Nothing overdue, closing soon or gone quiet." className="pb-10" />
      ) : (
        <>
          <ul className="px-2 pb-2">
            {shown.map((item) => (
              <li key={item.key} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-subtle">
                <span className={cx("size-2 shrink-0 rounded-full", SEVERITY_DOT[item.severity])} aria-label={item.severity === "danger" ? "Urgent" : item.severity === "warning" ? "Soon" : "Reminder"} />
                <button type="button" disabled={!item.appId} onClick={() => item.appId && onNavigate("detail", item.appId)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm text-fg">{item.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-fg-muted">{item.detail}</span>
                </button>
                {item.taskId ? (
                  <Button
                    size="sm"
                    variant="ghost"
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
            ))}
          </ul>
          {items.length > 5 && (
            <div className="mt-auto border-t border-line px-5 py-2.5">
              <LinkButton onClick={() => setExpanded((e) => !e)}>{expanded ? "Show fewer" : `Show ${items.length - 5} more`}</LinkButton>
            </div>
          )}
        </>
      )}
    </Section>
  );
}

// ---------- Agenda: upcoming + tasks ----------

function dayHeading(iso: string) {
  const d = daysUntil(iso);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return formatDate(iso, { weekday: true });
}

function AgendaCard({ upcoming, onNavigate, className }: { upcoming: CalendarItem[]; onNavigate: Navigate; className?: string }) {
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
      action={
        <Segmented
          size="sm"
          label="Agenda view"
          value={tab}
          onChange={setTab}
          options={[
            { value: "upcoming", label: "Upcoming" },
            { value: "tasks", label: openTasks ? `Tasks · ${openTasks}` : "Tasks" },
          ]}
        />
      }
    >
      {tab === "upcoming" ? <UpcomingList items={upcoming} onNavigate={onNavigate} /> : <TasksPanel embedded />}
    </Section>
  );
}

function UpcomingList({ items, onNavigate }: { items: CalendarItem[]; onNavigate: Navigate }) {
  const shown = items.slice(0, 4);
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

  if (groups.length === 0) {
    return <EmptyState compact title="Nothing in the next two weeks" description="Interviews, deadlines and events show up here." className="pb-10" />;
  }

  return (
    <>
      <div className="space-y-3 px-2 pb-2">
        {groups.map((group) => (
          <div key={group.date}>
            <p className={cx("px-3 pb-0.5 text-xs font-medium", daysUntil(group.date) === 0 ? "text-accent-fg" : "text-fg-muted")}>{dayHeading(group.date)}</p>
            <ul>
              {group.items.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => open(item)} className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-subtle">
                    <span className={cx("mt-[7px] size-1.5 shrink-0 rounded-full", KIND_META[item.kind].dot)} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-fg">{item.label}</span>
                      <span className="block truncate text-xs text-fg-muted">
                        {KIND_META[item.kind].label}
                        {item.time && ` · ${formatTime(item.time)}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-auto border-t border-line px-5 py-2.5">
        <LinkButton onClick={() => onNavigate("calendar")}>
          {items.length > shown.length ? `${items.length - shown.length} more in Calendar` : "Open Calendar"} <IconArrowRight size={14} />
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

  const toggle = (task: Task) => setTaskDone(task.id, !task.done).catch((e) => toast(`Couldn't update task: ${errorMessage(e)}`, { tone: "error" }));

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
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">Tasks</h2>
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

      {open.length === 0 ? (
        !draft && <p className="px-5 pt-2 pb-6 text-ui text-fg-muted">{done.length ? "Every task is done." : "Follow-ups and prep with a due date also appear on your calendar."}</p>
      ) : (
        <ul className="px-2 pb-2">
          {open.map((task) => (
            <TaskRow key={task.id} task={task} onToggle={() => toggle(task)} onDelete={() => remove(task)} />
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
              {done.map((task) => (
                <TaskRow key={task.id} task={task} onToggle={() => toggle(task)} onDelete={() => remove(task)} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, onToggle, onDelete }: { task: Task; onToggle: () => void; onDelete: () => void }) {
  return (
    <li className="group flex items-start gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-subtle">
      <Checkbox checked={task.done} onChange={onToggle} aria-label={task.done ? `Mark "${task.text}" as not done` : `Mark "${task.text}" as done`} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className={cx("text-sm leading-snug", task.done ? "text-fg-muted line-through" : "text-fg")}>{task.text}</p>
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

// ---------- Pipeline: one view at a time ----------

function PipelineCard({ onNavigate }: { onNavigate: Navigate }) {
  const { applications, recentActivity } = useData();
  const stats = useMemo(() => pipelineStats(applications), [applications]);
  const weeks = useMemo(() => weeklySubmissions(applications, 12), [applications]);
  const [tab, setTabState] = useState(lastPipelineTab);
  const setTab = (t: typeof tab) => {
    lastPipelineTab = t;
    setTabState(t);
  };

  const caption = {
    stages: `${stats.total} tracked · ${stats.submitted} submitted. Select a stage to see those applications.`,
    conversion: "How far your submitted applications have gotten. Hover a step for its conversion.",
    weekly: `${weeks.reduce((n, w) => n + w.count, 0)} applications submitted in the last 12 weeks.`,
    activity: "The latest changes across your applications.",
  }[tab];

  return (
    <Section
      title="Pipeline"
      action={
        <div className="-mx-1 overflow-x-auto px-1">
          <Segmented
            size="sm"
            label="Pipeline view"
            value={tab}
            onChange={setTab}
            options={[
              { value: "stages", label: "Stages" },
              { value: "conversion", label: "Conversion" },
              { value: "weekly", label: "Weekly" },
              { value: "activity", label: "Activity" },
            ]}
          />
        </div>
      }
    >
      <div className="px-5 pb-5">
        <p className="mb-5 text-ui text-fg-muted">{caption}</p>
        <div>
          {tab === "stages" && <StatusDistribution applications={applications} onSelect={(s) => onNavigate("applications", s)} />}
          {tab === "conversion" &&
            (stats.submitted === 0 ? (
              <p className="text-ui text-fg-muted">Conversion appears once you've submitted an application.</p>
            ) : (
              <div className="max-w-xl">
                <ConversionFunnel
                  steps={[
                    { label: "Submitted", value: stats.submitted },
                    { label: "Heard back", value: stats.heardBack },
                    { label: "Interviewed", value: stats.interviewed },
                    { label: "Offer", value: stats.offers },
                  ]}
                />
              </div>
            ))}
          {tab === "weekly" && <WeeklyColumns weeks={weeks} />}
          {tab === "activity" && <ActivityList items={recentActivity} onNavigate={onNavigate} />}
        </div>
      </div>
    </Section>
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
          <button key={opt.title} type="button" onClick={opt.onClick} className="group flex flex-col items-start rounded-lg border border-line p-4 text-left transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-card-hover">
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
