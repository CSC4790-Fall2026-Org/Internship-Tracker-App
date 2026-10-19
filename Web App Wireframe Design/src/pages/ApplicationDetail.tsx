import { useState } from "react";
import type { Application, AppStatus, InterviewStage, Task } from "../data/types";
import { useData } from "../data/DataContext";
import { STATUS } from "../data/status";
import { daysUntil, formatDate, formatTime, relativeDay, todayISO } from "../data/dates";
import { KIND_META } from "../data/insights";
import { Avatar, Badge, Button, Card, CardHeader, Checkbox, CompanyLogo, cx, DueChip, EmptyState, IconButton, Input, Page, Select, StatusSelect, Tabs, Textarea } from "../components/ui";
import { Menu } from "../components/overlay";
import { useFeedback, errorMessage } from "../components/feedback";
import ApplicationFormModal from "./AddApplication";
import {
  IconBanknote,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconExternal,
  IconFlag,
  IconMail,
  IconMessage,
  IconMore,
  IconPencil,
  IconPlus,
  IconSend,
  IconTaskSquare,
  IconTrash,
  IconUsers,
  IconX,
} from "../components/icons";

interface ApplicationDetailProps {
  appId: string;
  onNavigate: (screen: string, id?: string) => void;
}

type Tab = "overview" | "interviews" | "contacts";

export default function ApplicationDetail({ appId, onNavigate }: ApplicationDetailProps) {
  const { applications, updateApplication, deleteApplications } = useData();
  const { toast, confirm } = useFeedback();
  const app = applications.find((a) => a.id === appId);
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);

  if (!app) {
    return (
      <Page>
        <Card>
          <EmptyState
            title="Application not found"
            description="It may have been deleted, or the link is out of date."
            actions={
              <Button variant="primary" onClick={() => onNavigate("applications")}>
                Back to applications
              </Button>
            }
          />
        </Card>
      </Page>
    );
  }

  const changeStatus = (status: AppStatus) =>
    updateApplication(app.id, { status })
      .then(() => toast(status === "offer" ? `Congrats on the offer from ${app.company}! 🎉` : `Moved to ${STATUS[status].label}`))
      .catch((e) => toast(`Couldn't update status: ${errorMessage(e)}`, { tone: "error" }));

  const remove = async () => {
    const ok = await confirm({
      title: `Delete ${app.company} · ${app.position}?`,
      message: "Its interview stages are deleted too, and linked contacts are unlinked. This can't be undone.",
      confirmLabel: "Delete application",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteApplications([app.id]);
      toast(`Deleted ${app.company}`);
      onNavigate("applications");
    } catch (e) {
      toast(`Couldn't delete: ${errorMessage(e)}`, { tone: "error" });
    }
  };

  return (
    <Page>
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-ui text-fg-muted">
        <button type="button" onClick={() => onNavigate("applications")} className="rounded transition-colors hover:text-fg">
          Applications
        </button>
        <IconChevronRight size={14} className="text-fg-faint" />
        <span className="truncate text-fg-2" aria-current="page">
          {app.company}
        </span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start gap-x-4 gap-y-3">
        <CompanyLogo name={app.company} initials={app.logoInitials} color={app.logoColor} size={48} />
        <div className="min-w-0 flex-1 basis-48">
          <h1 className="text-xl font-semibold tracking-[-0.015em] text-fg">{app.position}</h1>
          <p className="mt-0.5 text-sm text-fg-muted">
            {app.company}
            {app.location && <> · {app.location}</>}
          </p>
        </div>
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
          <StatusSelect size="md" value={app.status} onChange={changeStatus} label="Stage" />
          <Button icon={IconPencil} onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Menu
            items={[
              ...(app.jobUrl ? [{ label: "Open job posting", icon: IconExternal, onSelect: () => window.open(app.jobUrl, "_blank", "noopener,noreferrer") }] : []),
              { label: "Edit details", icon: IconPencil, onSelect: () => setEditing(true) },
              "divider" as const,
              { label: "Delete application", icon: IconTrash, tone: "danger" as const, onSelect: remove },
            ]}
            trigger={(props) => <IconButton {...props} icon={IconMore} label="More actions" variant="secondary" />}
          />
        </div>
      </div>

      <StageTrack app={app} />

      {/* Facts */}
      <Card className="mt-4 mb-6">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card bg-line md:grid-cols-4">
          <Fact icon={IconSend} label="Applied">
            {app.appliedDate ? formatDate(app.appliedDate) : <span className="text-fg-muted">Not yet</span>}
          </Fact>
          <Fact icon={IconFlag} label="Deadline">
            {app.deadline ? (
              <span className="flex flex-wrap items-baseline gap-x-1.5">
                {formatDate(app.deadline)}
                {(app.status === "wishlist" || app.status === "applied") && daysUntil(app.deadline) >= -14 && daysUntil(app.deadline) <= 30 && <DueChip date={app.deadline} />}
              </span>
            ) : (
              <span className="text-fg-muted">None set</span>
            )}
          </Fact>
          <Fact icon={IconBanknote} label="Compensation">
            {app.salary || <span className="text-fg-muted">Not listed</span>}
          </Fact>
          <Fact icon={IconExternal} label="Posting">
            {app.jobUrl ? (
              <a href={app.jobUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 truncate font-medium text-accent-fg hover:underline hover:underline-offset-2">
                <span className="truncate">{hostOf(app.jobUrl)}</span>
              </a>
            ) : (
              <button type="button" onClick={() => setEditing(true)} className="text-fg-muted underline-offset-2 hover:text-fg hover:underline">
                Add link
              </button>
            )}
          </Fact>
        </dl>
      </Card>

      <Tabs
        label="Application sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "interviews", label: "Interviews", count: app.interviewStages.length },
          { value: "contacts", label: "Contacts", count: app.contacts.length },
        ]}
      />

      <div className="mt-5">
        {tab === "overview" && <Overview app={app} onShowTab={setTab} onNavigate={onNavigate} />}
        {tab === "interviews" && <Interviews app={app} />}
        {tab === "contacts" && <Contacts app={app} onNavigate={onNavigate} />}
      </div>

      {editing && <ApplicationFormModal application={app} onClose={() => setEditing(false)} />}
    </Page>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Fact({ icon: Icon, label, children }: { icon: typeof IconSend; label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 bg-surface px-4 py-3">
      <dt className="flex items-center gap-1.5 text-xs text-fg-muted">
        <Icon size={13} />
        {label}
      </dt>
      <dd className="mt-1 truncate text-ui text-fg">{children}</dd>
    </div>
  );
}

/** Wishlist → Applied → Interviewing → Offer, with Closed shown where the application stopped. */
function StageTrack({ app }: { app: Application }) {
  const steps: AppStatus[] = ["wishlist", "applied", "interviewing", "offer"];
  // Where a closed application got to, judged from what was logged.
  const reached = app.status === "rejected" ? (app.interviewStages.length > 0 ? 2 : app.appliedDate ? 1 : 0) : steps.indexOf(app.status);
  const closed = app.status === "rejected";
  return (
    <ol className="flex items-center gap-1.5" aria-label={`Stage: ${STATUS[app.status].label}`}>
      {steps.map((s, i) => {
        const done = i <= reached;
        const current = i === reached;
        return (
          <li key={s} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span
              className={cx("h-1 rounded-full transition-colors", done ? (closed ? "bg-status-rejected" : "") : "bg-muted-strong")}
              style={done && !closed ? { background: STATUS[app.status].mark } : undefined}
            />
            <span className={cx("truncate text-xs", current ? "font-medium text-fg" : done ? "text-fg-2" : "text-fg-muted")}>
              {current && closed ? `${STATUS[s].label} · Closed` : STATUS[s].label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------- Overview ----------

function Overview({ app, onShowTab, onNavigate }: { app: Application; onShowTab: (t: Tab) => void; onNavigate: (screen: string, id?: string) => void }) {
  const { tasks, events, updateApplication, addTask, setTaskDone } = useData();
  const { toast } = useFeedback();
  const [notesState, setNotesState] = useState<"idle" | "saving" | "saved">("idle");
  const [taskDraft, setTaskDraft] = useState<{ text: string; due: string } | null>(null);

  const saveNotes = async (value: string) => {
    if (value === app.notes) return;
    setNotesState("saving");
    try {
      await updateApplication(app.id, { notes: value });
      setNotesState("saved");
      setTimeout(() => setNotesState("idle"), 2000);
    } catch (e) {
      setNotesState("idle");
      toast(`Couldn't save notes: ${errorMessage(e)}`, { tone: "error" });
    }
  };

  const today = todayISO();
  const related: { key: string; kind: "task" | "event"; date: string; title: string; time: string; task?: Task; eventId?: string }[] = [
    ...tasks.filter((t) => t.applicationId === app.id).map((t) => ({ key: `t-${t.id}`, kind: "task" as const, date: t.due, title: t.text, task: t, time: "" })),
    ...events.filter((e) => e.applicationId === app.id).map((e) => ({ key: `e-${e.id}`, kind: "event" as const, date: e.date, title: e.title, eventId: e.id, time: e.startTime })),
  ];
  related.sort((a, b) => Number(!!(a.task?.done)) - Number(!!(b.task?.done)) || (a.date || "9999").localeCompare(b.date || "9999"));
  const nextStage = app.interviewStages.find((s) => !s.completed && s.date && s.date >= today);

  return (
    <div className="grid items-start gap-5 lg:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
        <Card>
          <CardHeader
            title="Notes"
            action={
              <span className="text-xs text-fg-muted" aria-live="polite">
                {notesState === "saving" ? "Saving…" : notesState === "saved" ? "Saved" : "Saves when you click away"}
              </span>
            }
          />
          <div className="px-4 pb-4">
            <Textarea
              aria-label="Notes"
              defaultValue={app.notes}
              placeholder="Referral, recruiter, what they're looking for, how it's going…"
              onBlur={(e) => saveNotes(e.target.value)}
              className="min-h-36 border-transparent bg-subtle shadow-none hover:border-line"
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            icon={IconTaskSquare}
            title="Tasks & events"
            description="Follow-ups and meetings linked to this application"
            action={!taskDraft && <IconButton icon={IconPlus} size="sm" label="Add task" onClick={() => setTaskDraft({ text: "", due: "" })} />}
          />
          {taskDraft && (
            <form
              className="mx-4 mb-3 flex flex-col gap-2 rounded-lg border border-line bg-subtle p-2.5 sm:flex-row"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!taskDraft.text.trim()) return;
                try {
                  await addTask({ text: taskDraft.text, due: taskDraft.due, applicationId: app.id });
                  setTaskDraft(null);
                  toast("Task added");
                } catch (err) {
                  toast(`Couldn't add task: ${errorMessage(err)}`, { tone: "error" });
                }
              }}
              onKeyDown={(e) => e.key === "Escape" && setTaskDraft(null)}
            >
              <Input autoFocus aria-label="Task" placeholder={`e.g. Follow up with ${app.company} recruiter`} value={taskDraft.text} onChange={(e) => setTaskDraft({ ...taskDraft, text: e.target.value })} className="flex-1" />
              <Input aria-label="Due date" type="date" value={taskDraft.due} onChange={(e) => setTaskDraft({ ...taskDraft, due: e.target.value })} className="sm:w-36" />
              <div className="flex gap-2">
                <Button size="md" variant="ghost" onClick={() => setTaskDraft(null)}>
                  Cancel
                </Button>
                <Button size="md" variant="primary" type="submit" disabled={!taskDraft.text.trim()}>
                  Add
                </Button>
              </div>
            </form>
          )}
          {related.length === 0 ? (
            !taskDraft && <EmptyState compact title="Nothing linked yet" description="Add a follow-up task, or link a calendar event to this application." className="pt-1" />
          ) : (
            <ul className="px-2 pb-2">
              {related.map((item) => (
                <li key={item.key} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/60">
                  {item.kind === "task" ? (
                    <Checkbox checked={item.task!.done} onChange={() => setTaskDone(item.task!.id, !item.task!.done).catch((e) => toast(errorMessage(e), { tone: "error" }))} aria-label={`Mark "${item.title}" ${item.task!.done ? "not done" : "done"}`} />
                  ) : (
                    <span className="flex size-4 items-center justify-center">
                      <span className={cx("size-2 rounded-full", KIND_META.event.dot)} />
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={item.kind === "task"}
                    onClick={() => item.kind === "event" && onNavigate("calendar", item.eventId)}
                    className={cx("min-w-0 flex-1 truncate text-left text-ui", item.task?.done ? "text-fg-muted line-through" : "text-fg")}
                  >
                    {item.title}
                  </button>
                  <span className="shrink-0 text-xs text-fg-muted">
                    {item.kind === "event" ? (
                      <>
                        {formatDate(item.date)}
                        {item.time && ` · ${formatTime(item.time)}`}
                      </>
                    ) : item.date ? (
                      item.task!.done ? formatDate(item.date) : <DueChip date={item.date} />
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <Card>
          <CardHeader
            icon={IconMessage}
            title="Interviews"
            action={
              <Button size="sm" variant="ghost" onClick={() => onShowTab("interviews")}>
                {app.interviewStages.length ? "Manage" : "Add round"}
              </Button>
            }
          />
          {app.interviewStages.length === 0 ? (
            <p className="px-4 pb-4 text-ui text-fg-muted">No rounds logged yet.</p>
          ) : (
            <ol className="px-4 pb-4">
              {app.interviewStages.map((stage, i) => (
                <li key={stage.id} className="relative flex gap-3 pb-3 last:pb-0">
                  {i < app.interviewStages.length - 1 && <span className="absolute top-5 bottom-0 left-[7px] w-px bg-line" aria-hidden="true" />}
                  <span className={cx("relative mt-0.5 flex size-[15px] shrink-0 items-center justify-center rounded-full", stage.completed ? "bg-status-interviewing text-white" : "border-[1.5px] border-line-strong bg-surface")}>
                    {stage.completed && <IconCheck size={9} strokeWidth={3.5} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cx("truncate text-ui", stage.completed ? "text-fg-muted" : "font-medium text-fg")}>{stage.name}</p>
                    {stage.date && <p className="text-xs text-fg-muted">{stage === nextStage ? relativeDay(stage.date) : formatDate(stage.date)}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card>
          <CardHeader
            icon={IconUsers}
            title="People"
            action={
              <Button size="sm" variant="ghost" onClick={() => onShowTab("contacts")}>
                {app.contacts.length ? "Manage" : "Add"}
              </Button>
            }
          />
          {app.contacts.length === 0 ? (
            <p className="px-4 pb-4 text-ui text-fg-muted">No one linked yet. Add the recruiter or a referral.</p>
          ) : (
            <ul className="px-2 pb-2">
              {app.contacts.map((c) => (
                <li key={c.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
                  <Avatar name={c.name} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-ui font-medium text-fg">{c.name}</p>
                    <p className="truncate text-xs text-fg-muted">{c.role || c.company}</p>
                  </div>
                  {c.email && (
                    <a href={`mailto:${c.email}`} aria-label={`Email ${c.name}`} title={c.email} className="rounded-md p-1.5 text-fg-muted transition-colors hover:bg-muted hover:text-fg">
                      <IconMail size={15} />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---------- Interviews ----------

function Interviews({ app }: { app: Application }) {
  const { addInterviewStage, setStageCompleted, deleteInterviewStage } = useData();
  const { toast, confirm } = useFeedback();
  const [draft, setDraft] = useState<{ name: string; date: string; notes: string } | null>(app.interviewStages.length === 0 ? { name: "", date: "", notes: "" } : null);
  const [saving, setSaving] = useState(false);
  const today = todayISO();

  const add = async () => {
    if (!draft?.name.trim()) return;
    setSaving(true);
    try {
      await addInterviewStage(app.id, draft);
      setDraft(null);
      toast("Interview round added");
    } catch (e) {
      toast(`Couldn't add round: ${errorMessage(e)}`, { tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const toggle = (stage: InterviewStage) =>
    setStageCompleted(stage.id, !stage.completed).catch((e) => toast(`Couldn't update: ${errorMessage(e)}`, { tone: "error" }));

  const remove = async (stage: InterviewStage) => {
    if (!(await confirm({ title: `Delete “${stage.name}”?`, message: "This removes the round and its notes.", confirmLabel: "Delete", tone: "danger" }))) return;
    deleteInterviewStage(stage.id).catch((e) => toast(`Couldn't delete: ${errorMessage(e)}`, { tone: "error" }));
  };

  return (
    <Card>
      <CardHeader
        title="Interview rounds"
        description="Log each round as it's scheduled; check it off once it's done."
        action={
          !draft && (
            <Button size="sm" icon={IconPlus} onClick={() => setDraft({ name: "", date: "", notes: "" })}>
              Add round
            </Button>
          )
        }
      />

      {draft && (
        <form
          className="mx-4 mb-4 grid gap-2 rounded-lg border border-line bg-subtle p-3 sm:grid-cols-[2fr_1fr]"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          onKeyDown={(e) => e.key === "Escape" && setDraft(null)}
        >
          <Input autoFocus aria-label="Round name" placeholder="Round name, e.g. Technical screen" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Input aria-label="Date" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          <Input aria-label="Notes" placeholder="Notes: who, format, what to prepare (optional)" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="sm:col-span-2" />
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={saving} disabled={!draft.name.trim()}>
              Add round
            </Button>
          </div>
        </form>
      )}

      {app.interviewStages.length === 0 ? (
        !draft && <EmptyState compact icon={IconClock} title="No rounds yet" description="Recruiter screens, technical interviews, onsites: log each one to track your progress." />
      ) : (
        <ol className="px-4 pb-4">
          {app.interviewStages.map((stage, i) => {
            const upcoming = !stage.completed && stage.date && stage.date >= today;
            const overdue = !stage.completed && stage.date && stage.date < today;
            return (
              <li key={stage.id} className="group relative flex gap-3.5 pb-5 last:pb-0">
                {i < app.interviewStages.length - 1 && <span className="absolute top-8 bottom-0 left-[13px] w-px bg-line" aria-hidden="true" />}
                <button
                  type="button"
                  aria-pressed={stage.completed}
                  aria-label={stage.completed ? `Mark ${stage.name} as not done` : `Mark ${stage.name} as done`}
                  title={stage.completed ? "Mark as not done" : "Mark as done"}
                  onClick={() => toggle(stage)}
                  className={cx(
                    "relative flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums transition-colors",
                    stage.completed ? "bg-status-interviewing text-white hover:opacity-90" : "border-[1.5px] border-line-strong bg-surface text-fg-muted hover:border-fg-faint hover:text-fg",
                  )}
                >
                  {stage.completed ? <IconCheck size={14} strokeWidth={3} /> : i + 1}
                </button>
                <div className="min-w-0 flex-1 rounded-lg border border-line px-3.5 py-2.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-ui font-medium text-fg">{stage.name}</p>
                    {stage.completed ? <Badge tone="success">Done</Badge> : upcoming ? <Badge tone="accent">{relativeDay(stage.date)}</Badge> : overdue ? <Badge tone="warning">Needs update</Badge> : null}
                    <span className="ml-auto flex items-center gap-1">
                      {stage.date && <span className="text-xs text-fg-muted tabular-nums">{formatDate(stage.date, { weekday: true })}</span>}
                      <IconButton icon={IconTrash} size="sm" label={`Delete ${stage.name}`} onClick={() => remove(stage)} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-lg:opacity-100" />
                    </span>
                  </div>
                  {stage.notes && <p className="mt-1 text-ui leading-relaxed text-fg-muted">{stage.notes}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

// ---------- Contacts ----------

function Contacts({ app, onNavigate }: { app: Application; onNavigate: (screen: string, id?: string) => void }) {
  const { contacts, addContact, setContactApplications } = useData();
  const { toast } = useFeedback();
  const [draft, setDraft] = useState<{ name: string; role: string; email: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // People not already on this application, with colleagues at the same company first.
  const linkable = contacts
    .filter((c) => !c.applicationIds.includes(app.id))
    .sort((a, b) => Number(b.company === app.company) - Number(a.company === app.company) || a.name.localeCompare(b.name));

  const run = async (op: () => Promise<unknown>, done: string) => {
    setSaving(true);
    try {
      await op();
      toast(done);
      return true;
    } catch (e) {
      toast(`Couldn't save: ${errorMessage(e)}`, { tone: "error" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="People"
        description="Recruiters, interviewers and referrals for this role"
        action={
          !draft && (
            <Button size="sm" icon={IconPlus} onClick={() => setDraft({ name: "", role: "", email: "" })}>
              New contact
            </Button>
          )
        }
      />

      {linkable.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          <Select
            aria-label="Link an existing contact"
            value=""
            disabled={saving}
            wrapperClassName="w-full sm:w-80"
            onChange={(e) => {
              const contact = contacts.find((c) => c.id === e.target.value);
              if (contact) run(() => setContactApplications(contact.id, [...contact.applicationIds, app.id]), `Linked ${contact.name}`);
            }}
          >
            <option value="">Link someone you already know…</option>
            {linkable.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.company ? ` · ${c.company}` : ""}
              </option>
            ))}
          </Select>
        </div>
      )}

      {draft && (
        <form
          className="mx-4 mb-4 grid gap-2 rounded-lg border border-line bg-subtle p-3 sm:grid-cols-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!draft.name.trim()) return;
            const ok = await run(() => addContact({ ...draft, company: app.company, phone: "", notes: "" }, [app.id]), `Added ${draft.name.trim()}`);
            if (ok) setDraft(null);
          }}
          onKeyDown={(e) => e.key === "Escape" && setDraft(null)}
        >
          <Input autoFocus aria-label="Name" placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Input aria-label="Role" placeholder="Role, e.g. Recruiter" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
          <Input aria-label="Email" type="email" placeholder="Email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
          <div className="flex justify-end gap-2 sm:col-span-3">
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={saving} disabled={!draft.name.trim()}>
              Add contact
            </Button>
          </div>
        </form>
      )}

      {app.contacts.length === 0 ? (
        !draft && <EmptyState compact icon={IconUsers} title="No one linked yet" description="Linking people here keeps track of who you've talked to for this role." />
      ) : (
        <ul className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
          {app.contacts.map((contact) => (
            <li key={contact.id} className="flex items-start gap-3 rounded-lg border border-line p-3">
              <Avatar name={contact.name} size={36} />
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => onNavigate("networking", contact.id)} className="block max-w-full truncate text-left text-ui font-medium text-fg hover:underline hover:underline-offset-2">
                  {contact.name}
                </button>
                <p className="truncate text-xs text-fg-muted">{[contact.role, contact.company].filter(Boolean).join(" · ") || "No role recorded"}</p>
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="mt-1.5 inline-flex max-w-full items-center gap-1.5 text-xs text-accent-fg hover:underline">
                    <IconMail size={13} />
                    <span className="truncate">{contact.email}</span>
                  </a>
                )}
              </div>
              <IconButton
                icon={IconX}
                size="sm"
                label={`Unlink ${contact.name}`}
                disabled={saving}
                onClick={() => run(() => setContactApplications(contact.id, contact.applicationIds.filter((id) => id !== app.id)), `Unlinked ${contact.name}`)}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
