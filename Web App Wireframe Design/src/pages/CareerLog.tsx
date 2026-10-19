import { useEffect, useMemo, useState } from "react";
import {
  addCareerLogEntry,
  CAREER_CATEGORIES,
  CATEGORY_LABEL,
  deleteCareerLogEntry,
  fetchCareerLog,
  sortEntries,
  updateCareerLogEntry,
  type CareerCategory,
  type CareerLogEntry,
  type CareerLogInput,
} from "../data/careerLog";
import { formatDate, todayISO } from "../data/dates";
import { Badge, Banner, Button, Card, cx, EmptyState, Field, Input, Page, PageHeader, Select, Skeleton, Textarea } from "../components/ui";
import { Modal } from "../components/overlay";
import { errorMessage, useFeedback } from "../components/feedback";
import { IconAlertCircle, IconCheckCircle, IconFile, IconFlag, IconGraduation, IconMessage, IconPlus, IconRefresh, IconSearch, IconTrash, IconTrophy, IconX, type IconComponent } from "../components/icons";

const CATEGORY_STYLE: Record<CareerCategory, { icon: IconComponent; tone: "success" | "accent" | "warning" | "neutral" }> = {
  accomplishment: { icon: IconCheckCircle, tone: "success" },
  project: { icon: IconFile, tone: "accent" },
  feedback: { icon: IconMessage, tone: "warning" },
  skill: { icon: IconGraduation, tone: "neutral" },
  milestone: { icon: IconFlag, tone: "neutral" },
};

const EMPTY: CareerLogInput = { category: "accomplishment", title: "", details: "", impact: "", date: "" };

export function CategoryBadge({ category }: { category: CareerCategory }) {
  const { icon, tone } = CATEGORY_STYLE[category];
  return (
    <Badge tone={tone} icon={icon}>
      {CATEGORY_LABEL[category]}
    </Badge>
  );
}

export default function CareerLog() {
  const [entries, setEntries] = useState<CareerLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [category, setCategory] = useState<CareerCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CareerLogEntry | "new" | null>(null);

  const load = () => {
    setLoading(true);
    fetchCareerLog()
      .then((rows) => {
        setEntries(rows);
        setLoadError(null);
      })
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const counts = useMemo(() => {
    const out = { all: entries.length } as Record<CareerCategory | "all", number>;
    for (const c of CAREER_CATEGORIES) out[c.value] = 0;
    for (const e of entries) out[e.category]++;
    return out;
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => (category === "all" || e.category === category) && (!q || [e.title, e.details, e.impact].some((field) => field.toLowerCase().includes(q))));
  }, [entries, category, search]);

  const onSaved = (saved: CareerLogEntry) => setEntries((list) => sortEntries([...list.filter((e) => e.id !== saved.id), saved]));
  const onDeleted = (id: string) => setEntries((list) => list.filter((e) => e.id !== id));

  const addButton = (
    <Button variant="primary" icon={IconPlus} onClick={() => setEditing("new")}>
      Add entry
    </Button>
  );

  return (
    <Page width="narrow">
      <PageHeader
        title="Career log"
        description={entries.length === 0 ? "Wins, projects, feedback and skills, written down while you still remember the details." : `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
        actions={!loading && !loadError && addButton}
      />

      {loadError ? (
        <Banner
          icon={IconAlertCircle}
          action={
            <Button size="sm" icon={IconRefresh} onClick={load}>
              Retry
            </Button>
          }
        >
          Couldn't load your career log: {loadError}
        </Banner>
      ) : loading ? (
        <Card className="space-y-3 p-4" role="status" aria-label="Loading your career log">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-2/3" />
        </Card>
      ) : entries.length === 0 ? (
        <Card>
          <EmptyState
            icon={IconTrophy}
            title="Nothing logged yet"
            description="Add the things you'd want to mention in a review, an interview or a resume update. Small wins count."
            actions={
              <Button variant="primary" icon={IconPlus} onClick={() => setEditing("new")}>
                Log your first entry
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="mb-3 flex flex-col gap-3">
            <div className="relative sm:w-80">
              <Input icon={IconSearch} type="search" aria-label="Search career log" placeholder="Search titles, details, impact" value={search} onChange={(e) => setSearch(e.target.value)} className="pr-8 [&::-webkit-search-cancel-button]:hidden" />
              {search && (
                <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-fg-faint hover:text-fg">
                  <IconX size={14} />
                </button>
              )}
            </div>
            <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-1.5">
              {[{ value: "all" as const, plural: "All" }, ...CAREER_CATEGORIES].map((c) => {
                const active = category === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCategory(c.value)}
                    className={cx(
                      "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-ui font-medium transition-colors",
                      active ? "border-ink bg-ink text-on-ink" : "border-line bg-surface text-fg-2 hover:border-line-strong hover:text-fg",
                    )}
                  >
                    {c.plural}
                    <span className={cx("text-2xs tabular-nums", active ? "text-on-ink/70" : "text-fg-muted")}>{counts[c.value]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Card className="overflow-hidden">
            {filtered.length === 0 ? (
              <EmptyState
                compact
                icon={IconSearch}
                title="No matching entries"
                description={search ? `Nothing matches “${search}”.` : "Nothing in this category yet."}
                actions={
                  <Button
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setCategory("all");
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <ul>
                {filtered.map((entry) => (
                  <li key={entry.id} className="border-b border-line last:border-b-0">
                    <button type="button" onClick={() => setEditing(entry)} className="block w-full px-4 py-3 text-left transition-colors hover:bg-subtle">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <CategoryBadge category={entry.category} />
                        <span className="min-w-0 flex-1 text-ui font-medium text-fg">{entry.title}</span>
                        <time dateTime={entry.date} className="text-xs whitespace-nowrap text-fg-muted">
                          {formatDate(entry.date)}
                        </time>
                      </div>
                      {entry.details && <p className="mt-1.5 line-clamp-2 text-ui leading-relaxed text-fg-muted">{entry.details}</p>}
                      {entry.impact && (
                        <p className="mt-1 text-ui leading-relaxed text-fg-2">
                          <span className="font-medium">Impact:</span> {entry.impact}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {editing && <EntryModal entry={editing === "new" ? null : editing} defaultCategory={category === "all" ? undefined : category} onClose={() => setEditing(null)} onSaved={onSaved} onDeleted={onDeleted} />}
    </Page>
  );
}

function EntryModal({
  entry,
  defaultCategory,
  onClose,
  onSaved,
  onDeleted,
}: {
  entry: CareerLogEntry | null;
  /** New entries start in the category being filtered, if any. */
  defaultCategory?: CareerCategory;
  onClose: () => void;
  onSaved: (entry: CareerLogEntry) => void;
  onDeleted: (id: string) => void;
}) {
  const { toast, confirm } = useFeedback();
  const [form, setForm] = useState<CareerLogInput>(
    entry ? { category: entry.category, title: entry.title, details: entry.details, impact: entry.impact, date: entry.date } : { ...EMPTY, category: defaultCategory ?? EMPTY.category, date: todayISO() },
  );
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof CareerLogInput>(field: K, value: CareerLogInput[K]) => setForm((f) => ({ ...f, [field]: value }));
  const titleError = form.title.trim() ? null : "Give it a short title.";
  const dateError = form.date ? null : "Pick a date.";
  const hint = CAREER_CATEGORIES.find((c) => c.value === form.category)?.hint;

  const save = async () => {
    setTouched(true);
    if (titleError || dateError) return;
    setSaving(true);
    setError(null);
    try {
      const saved = entry ? await updateCareerLogEntry(entry.id, form) : await addCareerLogEntry(form);
      onSaved(saved);
      toast(entry ? "Entry saved" : "Added to your career log");
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!entry) return;
    if (!(await confirm({ title: `Delete “${entry.title}”?`, message: "It will also disappear from your brag doc. This can't be undone.", confirmLabel: "Delete", tone: "danger" }))) return;
    setSaving(true);
    try {
      await deleteCareerLogEntry(entry.id);
      onDeleted(entry.id);
      toast("Entry deleted");
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={entry ? "Edit entry" : "New entry"}
      description={entry ? `Logged ${formatDate(entry.date, { long: true })}` : "Write it down while the details are fresh."}
      onClose={onClose}
      dismissible={!saving}
      footer={
        <>
          {entry && (
            <Button variant="danger-ghost" icon={IconTrash} onClick={remove} disabled={saving} className="mr-auto">
              Delete
            </Button>
          )}
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={saving}>
            {entry ? "Save changes" : "Add entry"}
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" hint={hint}>
            <Select value={form.category} onChange={(e) => set("category", e.target.value as CareerCategory)}>
              {CAREER_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date" required error={touched ? dateError : null}>
            <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
        </div>
        <Field label="Title" required error={touched ? titleError : null}>
          <Input data-autofocus value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Shipped the onboarding redesign" autoComplete="off" maxLength={200} />
        </Field>
        <Field label="Details" hint="What you did, who you worked with, what was hard.">
          <Textarea rows={3} value={form.details} onChange={(e) => set("details", e.target.value)} />
        </Field>
        <Field label="Impact" hint="Optional. The result, ideally with a number.">
          <Input value={form.impact} onChange={(e) => set("impact", e.target.value)} placeholder="e.g. Sign-up completion went from 52% to 71%" />
        </Field>
        <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}
