import { useState } from "react";
import type { Application, AppStatus } from "../data/types";
import { useData, type NewApplication } from "../data/DataContext";
import { STATUS, STATUS_ORDER } from "../data/status";
import { todayISO } from "../data/dates";
import { Button, Field, Input, Textarea, StatusDot, cx } from "../components/ui";
import { Modal } from "../components/overlay";
import { useFeedback, errorMessage } from "../components/feedback";
import { IconLink, IconMapPin, IconBanknote } from "../components/icons";

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

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) => setForm((f) => ({ ...f, [field]: value }));

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
          <Field label="Company" required error={touched ? errors.company : null}>
            <Input data-autofocus value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="e.g. Stripe" autoComplete="organization" />
          </Field>
          <Field label="Position" required error={touched ? errors.position : null}>
            <Input value={form.position} onChange={(e) => set("position", e.target.value)} placeholder="e.g. Software Engineer Intern" />
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
          <Field label="Job posting" hint="Link to the listing" className={editing && form.status !== "wishlist" ? "sm:col-span-1" : undefined}>
            <Input icon={IconLink} type="url" inputMode="url" value={form.jobUrl} onChange={(e) => set("jobUrl", e.target.value)} onBlur={(e) => set("jobUrl", normalizeUrl(e.target.value))} placeholder="company.com/careers/…" />
          </Field>
          <Field label="Application deadline" hint="Shown on your dashboard and calendar">
            <Input type="date" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} />
          </Field>
          {editing && form.status !== "wishlist" && (
            <Field label="Applied on">
              <Input type="date" value={form.appliedDate} max={todayISO()} onChange={(e) => set("appliedDate", e.target.value)} />
            </Field>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Location">
            <Input icon={IconMapPin} value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. New York, NY · Hybrid" />
          </Field>
          <Field label="Compensation">
            <Input icon={IconBanknote} value={form.salary} onChange={(e) => set("salary", e.target.value)} placeholder="e.g. $45/hr or $120k" />
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
