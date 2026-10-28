import { useState } from "react";
import type { Application, AppStatus } from "../data/types";
import { useData, type NewApplication } from "../data/DataContext";
import { STATUS, STATUS_ORDER } from "../data/status";
import { todayISO } from "../data/dates";
import { Banner, Button, Field, Input, Textarea, StatusDot, cx } from "../components/ui";
import { Modal } from "../components/overlay";
import { useFeedback, errorMessage } from "../components/feedback";
import { IconLink, IconMapPin, IconBanknote, IconSparkles, IconAlertTriangle, IconInfo } from "../components/icons";
import ImportPostingPanel from "../components/ImportPostingPanel";
import type { ExtractResult } from "../data/jobPosting";
import { appendNotes, conflictingFields, postingToForm, PREFILL_FIELDS, PREFILL_LABEL, type PrefillField } from "../data/jobPostingForm";

interface ApplicationFormProps {
  /** Present when editing; absent when adding. */
  application?: Application;
  initialStatus?: AppStatus;
  onClose: () => void;
  /** Called with the saved application's id. */
  onSaved?: (id: string) => void;
}

type FormState = NewApplication & { appliedDate: string };

/** Adds a scheme so "acme.com/jobs" still opens as a link. */
function normalizeUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed || /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export default function ApplicationFormModal({ application, initialStatus, onClose, onSaved }: ApplicationFormProps) {
  const { addApplication, updateApplication } = useData();
  const { toast } = useFeedback();
  const editing = !!application;
  const [form, setForm] = useState<FormState>(() => ({
    company: application?.company ?? "",
    position: application?.position ?? "",
    jobUrl: application?.jobUrl ?? "",
    deadline: application?.deadline ?? "",
    status: application?.status ?? initialStatus ?? "wishlist",
    location: application?.location ?? "",
    salary: application?.salary ?? "",
    notes: application?.notes ?? "",
    appliedDate: application?.appliedDate ?? "",
  }));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Fields last filled by "Import from posting" and not edited since; they're highlighted until the user touches them.
  const [aiFilled, setAiFilled] = useState<Set<PrefillField>>(new Set());
  // Imported values for fields the user had already typed into, waiting for them to choose.
  const [pendingReplace, setPendingReplace] = useState<Partial<Record<PrefillField, string>> | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (aiFilled.has(field as PrefillField)) {
      setAiFilled((prev) => {
        const next = new Set(prev);
        next.delete(field as PrefillField);
        return next;
      });
    }
  };

  const fillFields = (values: Partial<Record<PrefillField, string>>) => {
    setForm((f) => ({ ...f, ...values }));
    setAiFilled((prev) => new Set([...prev, ...(Object.keys(values) as PrefillField[])]));
  };

  const onExtracted = ({ posting, truncated }: ExtractResult, input: { text: string; url: string }) => {
    const { fields, notes } = postingToForm(posting, input);
    const conflicts = conflictingFields(form, fields);
    // Fill what's empty (or already matches) now; ask before replacing anything the user typed.
    const safe = Object.fromEntries(Object.entries(fields).filter(([f]) => !conflicts.includes(f as PrefillField)));
    fillFields(safe);
    setForm((f) => ({ ...f, notes: appendNotes(f.notes, notes) }));
    setPendingReplace(conflicts.length ? Object.fromEntries(conflicts.map((f) => [f, fields[f]!])) : null);

    const filled = Object.keys(safe).length;
    const found = Object.keys(fields).length;
    setImportNotice(
      [
        found === 0
          ? "No company, role or other form details were stated in the posting. What was found is in Notes."
          : `Filled ${filled} field${filled === 1 ? "" : "s"} from the posting. Check the highlighted ones before saving; the full description is in Notes.`,
        truncated && "The posting was long, so only the first 12,000 characters were read.",
      ]
        .filter(Boolean)
        .join(" "),
    );
  };

  const resolveReplace = (replace: boolean) => {
    if (replace && pendingReplace) fillFields(pendingReplace);
    setPendingReplace(null);
  };

  const aiHint = (field: PrefillField, fallback?: string) =>
    aiFilled.has(field) ? (
      <span className="inline-flex items-center gap-1 text-accent-fg">
        <IconSparkles size={12} />
        AI-filled · double-check
      </span>
    ) : (
      fallback
    );
  const aiClass = (field: PrefillField) => (aiFilled.has(field) ? "border-accent/50 bg-accent-soft/40" : undefined);

  const errors = {
    company: form.company.trim() ? null : "Enter the company name.",
    position: form.position.trim() ? null : "Enter the role you're applying for.",
  };
  const invalid = !!(errors.company || errors.position);

  const submit = async () => {
    setTouched(true);
    if (invalid || saving) return;
    setSaving(true);
    setError(null);
    const payload = { ...form, jobUrl: normalizeUrl(form.jobUrl) };
    try {
      if (application) {
        await updateApplication(application.id, {
          company: payload.company,
          position: payload.position,
          jobUrl: payload.jobUrl,
          deadline: payload.deadline,
          status: payload.status,
          location: payload.location,
          salary: payload.salary,
          // Moving out of Wishlist without a date means "today"; moving back clears nothing.
          appliedDate: payload.status !== "wishlist" && !payload.appliedDate ? todayISO() : payload.appliedDate,
        });
        toast("Changes saved");
        onClose();
        onSaved?.(application.id);
      } else {
        const id = await addApplication(payload);
        toast(`Added ${payload.company.trim()}`);
        onClose();
        onSaved?.(id);
      }
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <Modal
      size="lg"
      title={editing ? "Edit application" : "New application"}
      description={editing ? `${application.company} · ${application.position}` : "Track a job or internship you're interested in."}
      onClose={onClose}
      dismissible={!saving}
      footer={
        <>
          <span className="mr-auto hidden text-xs text-fg-muted sm:block">{isMac ? "⌘" : "Ctrl"} + Enter to save</span>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={saving}>
            {editing ? "Save changes" : "Add application"}
          </Button>
        </>
      }
    >
      {/* Outside the form, so Enter and Cmd+Enter in the import panel extract instead of saving. */}
      {!editing && (
        <div className="mb-5 space-y-3">
          <ImportPostingPanel onExtracted={onExtracted} disabled={saving} />
          {pendingReplace && (
            <Banner
              tone="warning"
              icon={IconAlertTriangle}
              action={
                <div className="flex gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => resolveReplace(false)}>
                    Keep mine
                  </Button>
                  <Button size="sm" onClick={() => resolveReplace(true)}>
                    Replace
                  </Button>
                </div>
              }
            >
              You already filled in {PREFILL_FIELDS.filter((f) => f in pendingReplace).map((f) => PREFILL_LABEL[f]).join(", ")}. Replace{" "}
              {Object.keys(pendingReplace).length === 1 ? "it" : "them"} with what the posting says?
            </Banner>
          )}
          {importNotice && (
            <Banner tone="info" icon={IconInfo} action={<Button size="sm" variant="ghost" onClick={() => setImportNotice(null)}>Dismiss</Button>}>
              {importNotice}
            </Banner>
          )}
        </div>
      )}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        className="space-y-5"
      >
        {error && (
          <p role="alert" className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-ui text-danger-fg">
            Couldn't save: {error}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company" required error={touched ? errors.company : null} hint={aiHint("company")}>
            <Input data-autofocus className={aiClass("company")} value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="e.g. Stripe" autoComplete="organization" />
          </Field>
          <Field label="Position" required error={touched ? errors.position : null} hint={aiHint("position")}>
            <Input className={aiClass("position")} value={form.position} onChange={(e) => set("position", e.target.value)} placeholder="e.g. Software Engineer Intern" />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-ui font-medium text-fg-2">Stage</legend>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5" role="radiogroup" aria-label="Stage">
            {STATUS_ORDER.map((s) => {
              const active = form.status === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  title={STATUS[s].hint}
                  onClick={() => set("status", s)}
                  className={cx(
                    "flex h-8 items-center gap-2 rounded-md border px-2.5 text-ui transition-[border-color,background-color,box-shadow]",
                    active ? "border-fg bg-surface font-medium text-fg shadow-[0_0_0_1px_var(--color-fg)]" : "border-line bg-surface text-fg-2 hover:border-line-strong hover:bg-subtle",
                  )}
                >
                  <StatusDot status={s} />
                  {STATUS[s].label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className={cx("grid gap-4", editing && form.status !== "wishlist" ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          <Field label="Job posting" hint={aiHint("jobUrl", "Link to the listing")} className={editing && form.status !== "wishlist" ? "sm:col-span-1" : undefined}>
            <Input icon={IconLink} className={aiClass("jobUrl")} type="url" inputMode="url" value={form.jobUrl} onChange={(e) => set("jobUrl", e.target.value)} onBlur={(e) => setForm((f) => ({ ...f, jobUrl: normalizeUrl(e.target.value) }))} placeholder="company.com/careers/…" />
          </Field>
          <Field label="Application deadline" hint={aiHint("deadline", "Shown on your dashboard and calendar")}>
            <Input type="date" className={aiClass("deadline")} value={form.deadline} onChange={(e) => set("deadline", e.target.value)} />
          </Field>
          {editing && form.status !== "wishlist" && (
            <Field label="Applied on">
              <Input type="date" value={form.appliedDate} max={todayISO()} onChange={(e) => set("appliedDate", e.target.value)} />
            </Field>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Location" hint={aiHint("location")}>
            <Input icon={IconMapPin} className={aiClass("location")} value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. New York, NY · Hybrid" />
          </Field>
          <Field label="Compensation" hint={aiHint("salary")}>
            <Input icon={IconBanknote} className={aiClass("salary")} value={form.salary} onChange={(e) => set("salary", e.target.value)} placeholder="e.g. $45/hr or $120k" />
          </Field>
        </div>

        {!editing && (
          <Field label="Notes">
            <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Referral, recruiter name, requirements, anything worth remembering…" />
          </Field>
        )}

        {/* Lets Enter submit from any single-line field. */}
        <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}
