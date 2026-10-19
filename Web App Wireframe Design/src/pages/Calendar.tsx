import { useEffect, useMemo, useState } from "react";
import { useData, type CalendarEventInput } from "../data/DataContext";
import type { CalendarEvent } from "../data/types";
import { daysUntil, formatDate, formatTime, isoOf, relativeDay, toDate, todayISO } from "../data/dates";
import { calendarItems, KIND_META, type CalendarItem, type ItemKind } from "../data/insights";
import { Button, Card, CardHeader, cx, EmptyState, Field, IconButton, Input, Page, PageHeader, Segmented, Select, Textarea } from "../components/ui";
import { Modal } from "../components/overlay";
import { useFeedback, errorMessage } from "../components/feedback";
import { IconCalendar, IconChevronLeft, IconChevronRight, IconFlag, IconMessage, IconPlus, IconTaskSquare, IconTrash, type IconComponent } from "../components/icons";

interface CalendarProps {
  onNavigate: (screen: string, id?: string) => void;
  /** Event to open on arrival, set when search jumps straight to one. */
  focusEventId?: string;
  /** Clears the request once handled, so the same event can be opened again. */
  onFocusHandled?: () => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const KIND_ORDER: ItemKind[] = ["deadline", "interview", "event", "task"];
// A glyph alongside the color, so kinds stay distinct without relying on hue.
const KIND_ICON: Record<ItemKind, IconComponent> = { deadline: IconFlag, interview: IconMessage, event: IconCalendar, task: IconTaskSquare };

export default function Calendar({ onNavigate, focusEventId, onFocusHandled }: CalendarProps) {
  const { applications, tasks, events } = useData();
  const today = todayISO();
  const [view, setView] = useState<"month" | "week">("month");
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState(today);
  const [editing, setEditing] = useState<CalendarEvent | { date: string } | null>(null);

  useEffect(() => {
    if (!focusEventId) return;
    const event = events.find((e) => e.id === focusEventId);
    if (event) {
      setAnchor(event.date);
      setSelected(event.date);
      setEditing(event);
    }
    onFocusHandled?.();
    // Only react to a new focus request, not to events reloading.
  }, [focusEventId]);

  const items = useMemo(() => calendarItems(applications, tasks, events), [applications, tasks, events]);
  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) map.set(item.date, [...(map.get(item.date) ?? []), item]);
    return map;
  }, [items]);
  // The selected day already has its own panel, so leave it out here.
  const upcoming = items.filter((item) => item.date >= today && item.date !== selected).slice(0, 8);

  // Month grid, padded to whole weeks.
  const cells = useMemo(() => {
    const a = toDate(anchor);
    const year = a.getFullYear();
    const month = a.getMonth();
    const leading = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const count = Math.ceil((leading + daysInMonth) / 7) * 7;
    return Array.from({ length: count }, (_, i) => {
      const date = new Date(year, month, 1 - leading + i);
      return { iso: isoOf(date), day: date.getDate(), inMonth: date.getMonth() === month };
    });
  }, [anchor]);

  // The seven days of the week containing the anchor, Sunday first.
  const weekCells = useMemo(() => {
    const a = toDate(anchor);
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(a.getFullYear(), a.getMonth(), a.getDate() - a.getDay() + i);
      return { iso: isoOf(date), day: date.getDate() };
    });
  }, [anchor]);

  const periodLabel = view === "month" ? toDate(anchor).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : weekRangeLabel(weekCells[0].iso, weekCells[6].iso);

  const shift = (delta: number) => {
    const d = toDate(anchor);
    setAnchor(isoOf(view === "month" ? new Date(d.getFullYear(), d.getMonth() + delta, 1) : new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta * 7)));
  };
  const openItem = (item: CalendarItem) => {
    if (item.event) setEditing(item.event);
    else if (item.applicationId) onNavigate("detail", item.applicationId);
  };
  const selectDay = (iso: string) => {
    setSelected(iso);
    if (view === "month" && toDate(iso).getMonth() !== toDate(anchor).getMonth()) setAnchor(iso);
  };

  const selectedItems = itemsByDate.get(selected) ?? [];

  return (
    <Page width="wide">
      <PageHeader
        title="Calendar"
        description="Deadlines, interviews, tasks and events in one place"
        actions={
          <>
            <Segmented
              label="Calendar view"
              value={view}
              onChange={(v) => {
                setView(v);
                setAnchor(selected);
              }}
              options={[
                { value: "month", label: "Month" },
                { value: "week", label: "Week" },
              ]}
            />
            <Button variant="primary" icon={IconPlus} onClick={() => setEditing({ date: selected >= today ? selected : today })}>
              Add event
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-3 py-2.5">
            <div className="flex items-center gap-1">
              <IconButton icon={IconChevronLeft} size="sm" label={`Previous ${view}`} onClick={() => shift(-1)} />
              <IconButton icon={IconChevronRight} size="sm" label={`Next ${view}`} onClick={() => shift(1)} />
              <h2 className="ml-1.5 text-sm font-semibold text-fg" aria-live="polite">
                {periodLabel}
              </h2>
              <Button
                size="sm"
                variant="ghost"
                className="ml-1"
                onClick={() => {
                  setAnchor(today);
                  setSelected(today);
                }}
              >
                Today
              </Button>
            </div>
            <ul className="ml-auto hidden items-center gap-3 sm:flex" aria-label="Legend">
              {KIND_ORDER.map((kind) => (
                <li key={kind} className="flex items-center gap-1.5 text-xs text-fg-muted">
                  <span className={cx("size-2 rounded-full", KIND_META[kind].dot)} aria-hidden="true" />
                  {KIND_META[kind].label}
                </li>
              ))}
            </ul>
          </div>

          {view === "month" ? (
            <div>
              <div className="grid grid-cols-7 border-b border-line bg-subtle">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="py-1.5 text-center text-2xs font-medium text-fg-muted">
                    <span className="sm:hidden">{day[0]}</span>
                    <span className="hidden sm:inline">{day}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((cell, i) => {
                  const dayItems = itemsByDate.get(cell.iso) ?? [];
                  const isToday = cell.iso === today;
                  const isSelected = cell.iso === selected;
                  return (
                    <div
                      key={cell.iso}
                      onClick={() => selectDay(cell.iso)}
                      onDoubleClick={() => setEditing({ date: cell.iso })}
                      className={cx(
                        "group relative min-h-16 cursor-pointer border-line p-1 transition-colors sm:min-h-[108px] sm:p-1.5",
                        (i + 1) % 7 !== 0 && "border-r",
                        i < cells.length - 7 && "border-b",
                        !cell.inMonth && "bg-subtle",
                        isSelected ? "bg-accent-soft/50" : "hover:bg-subtle",
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectDay(cell.iso);
                          }}
                          aria-label={`${formatDate(cell.iso, { weekday: true, long: true })}${dayItems.length ? `, ${dayItems.length} item${dayItems.length === 1 ? "" : "s"}` : ""}`}
                          aria-pressed={isSelected}
                          className={cx(
                            "flex size-6 items-center justify-center rounded-full text-xs tabular-nums transition-colors",
                            isToday ? "bg-accent font-semibold text-white" : isSelected ? "bg-fg font-medium text-on-ink" : cell.inMonth ? "text-fg-2" : "text-fg-muted",
                          )}
                        >
                          {cell.day}
                        </button>
                        <button
                          type="button"
                          aria-label={`Add event on ${formatDate(cell.iso, { long: true })}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing({ date: cell.iso });
                          }}
                          className="hidden size-5 items-center justify-center rounded text-fg-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted-strong hover:text-fg focus-visible:opacity-100 sm:flex"
                        >
                          <IconPlus size={13} />
                        </button>
                      </div>
                      {/* Phones get dots; wider screens get labels. */}
                      <div className="flex flex-wrap gap-0.5 px-0.5 sm:hidden">
                        {dayItems.slice(0, 4).map((item) => (
                          <span key={item.id} className={cx("size-1.5 rounded-full", KIND_META[item.kind].dot)} />
                        ))}
                      </div>
                      <div className="hidden flex-col gap-0.5 sm:flex">
                        {dayItems.slice(0, 3).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openItem(item);
                            }}
                            title={`${KIND_META[item.kind].label}: ${item.label}`}
                            className={cx("flex w-full items-center gap-1 truncate rounded px-1.5 py-[3px] text-left text-2xs font-medium transition-[filter] hover:brightness-95", KIND_META[item.kind].chip)}
                          >
                            {(() => {
                              const KindIcon = KIND_ICON[item.kind];
                              return <KindIcon size={11} strokeWidth={2} className="opacity-70" />;
                            })()}
                            <span className="truncate">
                              {item.time && <span className="tabular-nums opacity-75">{formatTime(item.time).replace(":00", "")} </span>}
                              {item.label}
                            </span>
                          </button>
                        ))}
                        {dayItems.length > 3 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectDay(cell.iso);
                            }}
                            className="rounded px-1.5 text-left text-2xs font-medium text-fg-muted hover:text-fg"
                          >
                            +{dayItems.length - 3} more
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="md:grid md:grid-cols-7">
              {weekCells.map((cell, i) => {
                const dayItems = itemsByDate.get(cell.iso) ?? [];
                const isToday = cell.iso === today;
                return (
                  <div
                    key={cell.iso}
                    onClick={() => selectDay(cell.iso)}
                    onDoubleClick={() => setEditing({ date: cell.iso })}
                    className={cx("group cursor-pointer border-line md:min-h-[460px]", i < 6 && "border-b md:border-r md:border-b-0", cell.iso === selected ? "bg-accent-soft/40" : "hover:bg-subtle/60")}
                  >
                    <div className="flex items-center justify-between gap-2 border-line px-3 py-2 md:flex-col md:items-center md:border-b md:px-2 md:py-2.5">
                      <div className="flex items-baseline gap-2 md:flex-col md:items-center md:gap-0.5">
                        <span className="text-2xs font-medium text-fg-muted">{WEEKDAYS[i]}</span>
                        <span className={cx("flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums", isToday ? "bg-accent text-white" : "text-fg")}>{cell.day}</span>
                      </div>
                      <button
                        type="button"
                        aria-label={`Add event on ${formatDate(cell.iso, { long: true })}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing({ date: cell.iso });
                        }}
                        className="flex size-6 items-center justify-center rounded text-fg-muted hover:bg-muted-strong hover:text-fg md:hidden"
                      >
                        <IconPlus size={14} />
                      </button>
                    </div>
                    <div className="flex flex-col gap-1 px-2 pb-2 md:pt-2">
                      {dayItems.length === 0 ? (
                        <p className="hidden py-3 text-center text-2xs text-fg-muted md:block">Nothing</p>
                      ) : (
                        dayItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openItem(item);
                            }}
                            className={cx("w-full rounded-md px-2 py-1.5 text-left transition-[filter] hover:brightness-95", KIND_META[item.kind].chip)}
                          >
                            <span className="block text-xs leading-snug font-medium">{item.label}</span>
                            <span className="mt-0.5 block truncate text-2xs opacity-80">
                              {item.time ? formatTime(item.time) : KIND_META[item.kind].label}
                              {item.detail && item.kind !== "event" && ` · ${item.detail}`}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader
              title={relativeDay(selected) === "Today" || relativeDay(selected) === "Tomorrow" ? `${relativeDay(selected)} · ${formatDate(selected, { weekday: true })}` : formatDate(selected, { weekday: true, long: true })}
              description={selectedItems.length ? `${selectedItems.length} item${selectedItems.length === 1 ? "" : "s"}` : undefined}
              action={<IconButton icon={IconPlus} size="sm" label="Add event on this day" onClick={() => setEditing({ date: selected })} />}
            />
            {selectedItems.length === 0 ? (
              <p className="px-4 pb-4 text-ui text-fg-muted">Nothing on this day.</p>
            ) : (
              <ul className="px-2 pb-2">
                {selectedItems.map((item) => (
                  <AgendaRow key={item.id} item={item} onOpen={() => openItem(item)} />
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader icon={IconCalendar} title="Coming up" />
            {upcoming.length === 0 ? (
              <EmptyState compact title="Nothing scheduled" description="Double-click any day, or use Add event." className="pt-0" />
            ) : (
              <ul className="px-2 pb-2">
                {upcoming.map((item) => (
                  <AgendaRow key={item.id} item={item} onOpen={() => openItem(item)} showDate />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {editing && <EventModal event={"id" in editing ? editing : null} defaultDate={editing.date} onClose={() => setEditing(null)} />}
    </Page>
  );
}

function AgendaRow({ item, onOpen, showDate }: { item: CalendarItem; onOpen: () => void; showDate?: boolean }) {
  const days = daysUntil(item.date);
  const clickable = !!item.event || !!item.applicationId;
  return (
    <li>
      <button type="button" disabled={!clickable} onClick={onOpen} className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors enabled:hover:bg-muted">
        <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", KIND_META[item.kind].dot)} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ui text-fg">{item.label}</span>
          <span className="block truncate text-xs text-fg-muted">
            {showDate && <>{days === 0 ? "Today" : days === 1 ? "Tomorrow" : formatDate(item.date, { weekday: true })} · </>}
            {item.time ? formatTime(item.time) : KIND_META[item.kind].label}
            {item.detail && item.kind !== "event" && ` · ${item.detail}`}
          </span>
        </span>
      </button>
    </li>
  );
}

/** "Sep 20 – 26, 2026", widening to months or years only when the week spans them. */
function weekRangeLabel(startIso: string, endIso: string) {
  const start = toDate(startIso);
  const end = toDate(endIso);
  const year = end.getFullYear();
  const md = (d: Date, withYear = false) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: withYear ? "numeric" : undefined });
  if (start.getFullYear() !== year) return `${md(start, true)} – ${md(end, true)}`;
  if (start.getMonth() !== end.getMonth()) return `${md(start)} – ${md(end)}, ${year}`;
  return `${md(start)} – ${end.getDate()}, ${year}`;
}

function EventModal({ event, defaultDate, onClose }: { event: CalendarEvent | null; defaultDate: string; onClose: () => void }) {
  const { applications, addEvent, updateEvent, deleteEvent } = useData();
  const { toast, confirm } = useFeedback();
  const [form, setForm] = useState<CalendarEventInput>({
    title: event?.title ?? "",
    date: event?.date ?? defaultDate,
    startTime: event?.startTime ?? "",
    notes: event?.notes ?? "",
    applicationId: event?.applicationId ?? null,
  });
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof CalendarEventInput>(field: K, value: CalendarEventInput[K]) => setForm((f) => ({ ...f, [field]: value }));
  const titleError = form.title.trim() ? null : "Give the event a title.";
  const dateError = form.date ? null : "Pick a date.";

  const save = async () => {
    setTouched(true);
    if (titleError || dateError) return;
    setSaving(true);
    setError(null);
    try {
      if (event) await updateEvent(event.id, form);
      else await addEvent(form);
      toast(event ? "Event updated" : `Added “${form.title.trim()}”`);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!event) return;
    if (!(await confirm({ title: `Delete “${event.title}”?`, message: "This can't be undone.", confirmLabel: "Delete", tone: "danger" }))) return;
    setSaving(true);
    try {
      await deleteEvent(event.id);
      toast("Event deleted");
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={event ? "Edit event" : "New event"}
      description={event ? undefined : "Coffee chats, info sessions, career fairs, anything with a date."}
      onClose={onClose}
      dismissible={!saving}
      footer={
        <>
          {event && (
            <Button variant="danger-ghost" icon={IconTrash} onClick={remove} disabled={saving} className="mr-auto">
              Delete
            </Button>
          )}
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={saving}>
            {event ? "Save changes" : "Add event"}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {error && (
          <p role="alert" className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-ui text-danger-fg">
            Couldn't save: {error}
          </p>
        )}
        <Field label="Title" required error={touched ? titleError : null}>
          <Input data-autofocus value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Coffee chat with Sarah Chen" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date" required error={touched ? dateError : null}>
            <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="Time" hint="Optional">
            <Input type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
          </Field>
        </div>
        <Field label="Related application">
          <Select value={form.applicationId ?? ""} onChange={(e) => set("applicationId", e.target.value || null)}>
            <option value="">None</option>
            {applications.map((app) => (
              <option key={app.id} value={app.id}>
                {app.company} · {app.position}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes">
          <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Location, agenda, what to prepare…" />
        </Field>
        <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}
