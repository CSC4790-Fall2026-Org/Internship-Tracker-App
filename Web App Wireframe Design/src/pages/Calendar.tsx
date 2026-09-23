import { useMemo, useState } from "react";
import { useData, type CalendarEventInput } from "../data/DataContext";
import type { CalendarEvent } from "../data/types";
import { toDate, todayISO } from "../data/dates";

interface CalendarProps {
  onNavigate: (screen: string, id?: string) => void;
}

type ItemKind = "deadline" | "interview" | "task" | "event";

interface CalendarItem {
  id: string;
  kind: ItemKind;
  date: string;
  label: string;
  detail: string;
  time: string;
  applicationId: string | null;
  event?: CalendarEvent;
}

const KIND_META: Record<ItemKind, { color: string; bg: string; label: string }> = {
  deadline: { color: "#B45309", bg: "#FEF3C7", label: "Deadline" },
  interview: { color: "#6D28D9", bg: "#EDE9FE", label: "Interview" },
  task: { color: "#475569", bg: "#F1F5F9", label: "Task" },
  event: { color: "#1D4ED8", bg: "#DBEAFE", label: "Event" },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isoOf(year: number, month: number, day: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function formatTime(time: string) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${period}`;
}

export default function Calendar({ onNavigate }: CalendarProps) {
  const { applications, tasks, events } = useData();
  const today = todayISO();
  const [view, setView] = useState<"month" | "week">("month");
  const [anchor, setAnchor] = useState(today);
  const [editing, setEditing] = useState<CalendarEvent | { date: string } | null>(null);

  // Everything dated, from all four sources.
  const items = useMemo<CalendarItem[]>(() => {
    const out: CalendarItem[] = [];

    for (const app of applications) {
      if (app.deadline && app.status !== "rejected") {
        out.push({
          id: `deadline-${app.id}`,
          kind: "deadline",
          date: app.deadline,
          label: `${app.company} deadline`,
          detail: app.position,
          time: "",
          applicationId: app.id,
        });
      }
      for (const stage of app.interviewStages) {
        if (stage.date) {
          out.push({
            id: `stage-${stage.id}`,
            kind: "interview",
            date: stage.date,
            label: `${app.company} — ${stage.name}`,
            detail: app.position,
            time: "",
            applicationId: app.id,
          });
        }
      }
    }

    for (const task of tasks) {
      if (task.due && !task.done) {
        out.push({
          id: `task-${task.id}`,
          kind: "task",
          date: task.due,
          label: task.text,
          detail: task.company,
          time: "",
          applicationId: task.applicationId,
        });
      }
    }

    for (const event of events) {
      out.push({
        id: `event-${event.id}`,
        kind: "event",
        date: event.date,
        label: event.title,
        detail: event.notes,
        time: event.startTime,
        applicationId: event.applicationId,
        event,
      });
    }

    return out.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  }, [applications, tasks, events]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) map.set(item.date, [...(map.get(item.date) ?? []), item]);
    return map;
  }, [items]);

  const upcoming = items.filter((item) => item.date >= today).slice(0, 8);

  // Month grid, padded to whole weeks.
  const cells = useMemo(() => {
    const anchorDate = toDate(anchor);
    const year = anchorDate.getFullYear();
    const month = anchorDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leading = new Date(year, month, 1).getDay();
    const out: { iso: string; day: number; inMonth: boolean }[] = [];

    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = leading - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const date = new Date(year, month - 1, d);
      out.push({ iso: isoOf(date.getFullYear(), date.getMonth(), d), day: d, inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ iso: isoOf(year, month, d), day: d, inMonth: true });
    }
    while (out.length % 7 !== 0) {
      const d = out.length - leading - daysInMonth + 1;
      const date = new Date(year, month + 1, d);
      out.push({ iso: isoOf(date.getFullYear(), date.getMonth(), d), day: d, inMonth: false });
    }
    return out;
  }, [anchor]);

  // The seven days of the week containing the anchor, Sunday first.
  const weekCells = useMemo(() => {
    const anchorDate = toDate(anchor);
    const start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate() - anchorDate.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return { iso: isoOf(date.getFullYear(), date.getMonth(), date.getDate()), day: date.getDate() };
    });
  }, [anchor]);

  const periodLabel =
    view === "month"
      ? toDate(anchor).toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : weekRangeLabel(weekCells[0].iso, weekCells[6].iso);

  const shift = (delta: number) => {
    const date = toDate(anchor);
    const next =
      view === "month"
        ? new Date(date.getFullYear(), date.getMonth() + delta, 1)
        : new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta * 7);
    setAnchor(isoOf(next.getFullYear(), next.getMonth(), next.getDate()));
  };
  const openItem = (item: CalendarItem) => {
    if (item.event) setEditing(item.event);
    else if (item.applicationId) onNavigate("detail", item.applicationId);
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "1.5rem", fontWeight: 700, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
            Calendar
          </h1>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--muted-foreground)", marginTop: "2px" }}>
            Deadlines, interviews and anything else you add
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div style={{ display: "flex", background: "var(--muted)", borderRadius: "8px", padding: "3px", gap: "2px" }}>
            {(["month", "week"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: "5px 12px", borderRadius: "6px", border: "none",
                  background: view === v ? "var(--card)" : "transparent",
                  boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  fontFamily: "var(--font-body)", fontSize: "0.8rem",
                  fontWeight: view === v ? 600 : 400,
                  color: view === v ? "var(--primary)" : "var(--muted-foreground)",
                  cursor: "pointer", textTransform: "capitalize", transition: "all 0.15s",
                }}
              >
                {v}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "2px", background: "var(--muted)", borderRadius: "8px", padding: "3px" }}>
            <NavButton label={`Previous ${view}`} onClick={() => shift(-1)} path="M7 2L3 6l4 4" />
            <button
              onClick={() => setAnchor(today)}
              style={{ padding: "5px 12px", borderRadius: "6px", border: "none", background: "transparent", fontFamily: "var(--font-body)", fontSize: "0.8rem", fontWeight: 500, color: "var(--foreground)", cursor: "pointer" }}
            >
              Today
            </button>
            <NavButton label={`Next ${view}`} onClick={() => shift(1)} path="M5 2l4 4-4 4" />
          </div>
          <button
            onClick={() => setEditing({ date: today })}
            style={{ background: "var(--primary)", color: "white", border: "none", borderRadius: "8px", padding: "8px 14px", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.88")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add Event
          </button>
        </div>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 300px", alignItems: "start" }}>
        {/* Month or week grid */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "1rem", color: "var(--foreground)" }}>
              {periodLabel}
            </h2>
            <div className="flex items-center gap-3">
              {(Object.keys(KIND_META) as ItemKind[]).map((kind) => (
                <div key={kind} className="flex items-center gap-1.5">
                  <span style={{ width: "7px", height: "7px", borderRadius: "2px", background: KIND_META[kind].color, display: "inline-block" }} />
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--muted-foreground)" }}>
                    {KIND_META[kind].label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {view === "month" ? (
            <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--border)", background: "var(--muted)" }}>
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  style={{ padding: "8px", textAlign: "center", fontFamily: "var(--font-body)", fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.03em" }}
                >
                  {day}
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {cells.map((cell, i) => {
                const dayItems = itemsByDate.get(cell.iso) ?? [];
                const isToday = cell.iso === today;
                return (
                  <div
                    key={cell.iso + i}
                    onClick={() => setEditing({ date: cell.iso })}
                    title="Add an event on this day"
                    style={{
                      minHeight: "104px", padding: "6px", cursor: "pointer",
                      borderRight: (i + 1) % 7 === 0 ? "none" : "1px solid var(--border)",
                      borderBottom: i < cells.length - 7 ? "1px solid var(--border)" : "none",
                      background: cell.inMonth ? "transparent" : "var(--muted)",
                      opacity: cell.inMonth ? 1 : 0.55,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "4px" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-mono-base)", fontSize: "0.6875rem",
                          fontWeight: isToday ? 700 : 500,
                          color: isToday ? "white" : "var(--muted-foreground)",
                          background: isToday ? "var(--primary)" : "transparent",
                          borderRadius: "100px", padding: isToday ? "2px 6px" : "2px 3px",
                        }}
                      >
                        {cell.day}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {dayItems.slice(0, 3).map((item) => (
                        <button
                          key={item.id}
                          onClick={(e) => { e.stopPropagation(); openItem(item); }}
                          title={`${KIND_META[item.kind].label}: ${item.label}`}
                          style={{
                            width: "100%", textAlign: "left", border: "none", cursor: "pointer",
                            background: KIND_META[item.kind].bg, color: KIND_META[item.kind].color,
                            borderRadius: "4px", padding: "2px 5px",
                            fontFamily: "var(--font-body)", fontSize: "0.6625rem", fontWeight: 500,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}
                        >
                          {item.time && `${formatTime(item.time)} `}
                          {item.label}
                        </button>
                      ))}
                      {dayItems.length > 3 && (
                        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.625rem", color: "var(--muted-foreground)", paddingLeft: "5px" }}>
                          +{dayItems.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            </>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {weekCells.map((cell, i) => {
                const dayItems = itemsByDate.get(cell.iso) ?? [];
                const isToday = cell.iso === today;
                const date = toDate(cell.iso);
                return (
                  <div
                    key={cell.iso}
                    onClick={() => setEditing({ date: cell.iso })}
                    title="Add an event on this day"
                    style={{
                      minHeight: "460px", cursor: "pointer",
                      borderRight: i === 6 ? "none" : "1px solid var(--border)",
                      background: isToday ? "var(--accent)" : "transparent",
                    }}
                  >
                    <div style={{ padding: "10px 8px", borderBottom: "1px solid var(--border)", textAlign: "center", background: isToday ? "transparent" : "var(--muted)" }}>
                      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                        {WEEKDAYS[i]}
                      </p>
                      <p
                        style={{
                          fontFamily: "var(--font-heading)", fontSize: "1.125rem", fontWeight: 700, marginTop: "2px",
                          color: isToday ? "var(--primary)" : "var(--foreground)",
                        }}
                      >
                        {cell.day}
                      </p>
                      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.625rem", color: "var(--muted-foreground)" }}>
                        {date.toLocaleDateString("en-US", { month: "short" })}
                      </p>
                    </div>

                    <div className="flex flex-col gap-1.5" style={{ padding: "8px" }}>
                      {dayItems.length === 0 ? (
                        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--muted-foreground)", textAlign: "center", paddingTop: "12px" }}>
                          —
                        </p>
                      ) : (
                        dayItems.map((item) => (
                          <button
                            key={item.id}
                            onClick={(e) => { e.stopPropagation(); openItem(item); }}
                            style={{
                              width: "100%", textAlign: "left", border: "none", cursor: "pointer",
                              background: KIND_META[item.kind].bg, color: KIND_META[item.kind].color,
                              borderRadius: "6px", padding: "7px 8px",
                            }}
                          >
                            <span style={{ display: "block", fontFamily: "var(--font-body)", fontSize: "0.6875rem", fontWeight: 600, lineHeight: 1.35 }}>
                              {item.label}
                            </span>
                            {(item.time || item.detail) && (
                              <span style={{ display: "block", fontFamily: "var(--font-body)", fontSize: "0.625rem", opacity: 0.8, marginTop: "2px", lineHeight: 1.35 }}>
                                {item.time ? formatTime(item.time) : KIND_META[item.kind].label}
                                {item.detail && ` · ${item.detail}`}
                              </span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px" }}>
          <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.9375rem", color: "var(--foreground)", marginBottom: "14px" }}>
            Upcoming
          </h2>
          {upcoming.length === 0 ? (
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--muted-foreground)" }}>
              Nothing scheduled. Click any day to add an event.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {upcoming.map((item) => {
                const days = Math.round((toDate(item.date).getTime() - toDate(today).getTime()) / 86_400_000);
                return (
                  <button
                    key={item.id}
                    onClick={() => openItem(item)}
                    style={{
                      display: "flex", gap: "10px", alignItems: "flex-start", width: "100%", textAlign: "left",
                      padding: "9px 10px", borderRadius: "7px", border: "none", background: "var(--muted)", cursor: "pointer",
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--accent)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--muted)")}
                  >
                    <span style={{ width: "3px", alignSelf: "stretch", borderRadius: "2px", background: KIND_META[item.kind].color, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.8rem", color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.label}
                      </span>
                      <span style={{ display: "block", fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--muted-foreground)", marginTop: "1px" }}>
                        {toDate(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {item.time && ` · ${formatTime(item.time)}`}
                        {" · "}
                        {days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <EventModal
          event={"id" in editing ? editing : null}
          defaultDate={"id" in editing ? editing.date : editing.date}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/** "Sep 20 – 26, 2026", widening to months or years only when the week spans them. */
function weekRangeLabel(startIso: string, endIso: string) {
  const start = toDate(startIso);
  const end = toDate(endIso);
  const year = end.getFullYear();
  if (start.getFullYear() !== year) {
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${year}`;
  }
  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.getDate()}, ${year}`;
}

function NavButton({ label, onClick, path }: { label: string; onClick: () => void; path: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{ padding: "5px 9px", borderRadius: "6px", border: "none", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)", display: "flex", alignItems: "center" }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d={path} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function EventModal({ event, defaultDate, onClose }: { event: CalendarEvent | null; defaultDate: string; onClose: () => void }) {
  const { applications, addEvent, updateEvent, deleteEvent } = useData();
  const [form, setForm] = useState<CalendarEventInput>({
    title: event?.title ?? "",
    date: event?.date ?? defaultDate,
    startTime: event?.startTime ?? "",
    notes: event?.notes ?? "",
    applicationId: event?.applicationId ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof CalendarEventInput>(field: K, value: CalendarEventInput[K]) =>
    setForm((f) => ({ ...f, [field]: value }));

  const save = async () => {
    if (!form.title.trim()) {
      setError("Give the event a title.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (event) await updateEvent(event.id, form);
      else await addEvent(form);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!event || !confirm(`Delete "${event.title}"?`)) return;
    setSaving(true);
    try {
      await deleteEvent(event.id);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div style={{ background: "var(--card)", borderRadius: "16px", border: "1px solid var(--border)", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", width: "100%", maxWidth: "480px", maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.125rem", fontWeight: 700, color: "var(--foreground)", letterSpacing: "-0.01em" }}>
            {event ? "Edit Event" : "New Event"}
          </h2>
          <button
            onClick={onClose}
            style={{ width: "32px", height: "32px", borderRadius: "8px", background: "var(--muted)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--muted-foreground)" }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div style={{ padding: "24px" }}>
          <div className="mb-4">
            <label style={labelStyle}>Title <span style={{ color: "#EF4444" }}>*</span></label>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Coffee chat with Sarah Chen"
              style={fieldStyle}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Time</label>
              <input type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} style={fieldStyle} />
            </div>
          </div>

          <div className="mb-4">
            <label style={labelStyle}>Related application</label>
            <select
              value={form.applicationId ?? ""}
              onChange={(e) => set("applicationId", e.target.value || null)}
              style={fieldStyle}
            >
              <option value="">None</option>
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.company} · {app.position}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label style={labelStyle}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              placeholder="Location, agenda, what to prepare…"
              style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.6 }}
            />
          </div>

          {error && (
            <p role="alert" style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "#B91C1C", background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: "8px", padding: "8px 12px", marginBottom: "12px" }}>
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              style={{ flex: 1, background: "var(--primary)", color: "white", border: "none", borderRadius: "9px", padding: "10px", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.875rem", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Saving…" : event ? "Save changes" : "Add event"}
            </button>
            {event && (
              <button
                onClick={remove}
                disabled={saving}
                style={{ padding: "10px 16px", background: "#FEE2E2", color: "#DC2626", border: "1px solid #FCA5A544", borderRadius: "9px", fontFamily: "var(--font-body)", fontWeight: 500, fontSize: "0.875rem", cursor: saving ? "not-allowed" : "pointer" }}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "9px 12px",
  fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--foreground)",
  background: "var(--muted)", border: "1px solid var(--border)", borderRadius: "8px", outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)", fontSize: "0.8rem", fontWeight: 500,
  color: "var(--foreground)", display: "block", marginBottom: "5px",
};
