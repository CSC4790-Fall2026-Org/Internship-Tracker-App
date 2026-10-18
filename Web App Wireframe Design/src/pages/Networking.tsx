import { useEffect, useMemo, useState } from "react";
import { useData, type ContactInput } from "../data/DataContext";
import type { Application, Contact } from "../data/types";
import { Avatar, Button, Card, Checkbox, CompanyLogo, cx, EmptyState, Field, Input, Page, PageHeader, Segmented, StatusDot, Textarea } from "../components/ui";
import { Modal } from "../components/overlay";
import { useFeedback, errorMessage } from "../components/feedback";
import { IconChevronRight, IconMail, IconPhone, IconPlus, IconSearch, IconTrash, IconUsers, IconX } from "../components/icons";

interface NetworkingProps {
  onNavigate: (screen: string, id?: string) => void;
  /** Contact to open on arrival, set when search jumps straight to a person. */
  focusContactId?: string;
  /** Clears the request once handled, so the same person can be opened again. */
  onFocusHandled?: () => void;
}

const EMPTY: ContactInput = { name: "", role: "", company: "", email: "", phone: "", notes: "" };

export default function Networking({ onNavigate, focusContactId, onFocusHandled }: NetworkingProps) {
  const { contacts, applications } = useData();
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"all" | "linked" | "unlinked">("all");
  const [editing, setEditing] = useState<Contact | "new" | null>(null);

  useEffect(() => {
    if (!focusContactId) return;
    const contact = contacts.find((c) => c.id === focusContactId);
    if (contact) setEditing(contact);
    onFocusHandled?.();
    // Only react to a new focus request, not to contacts reloading.
  }, [focusContactId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter(
      (c) =>
        (scope === "all" || (scope === "linked" ? c.applicationIds.length > 0 : c.applicationIds.length === 0)) &&
        (!q || [c.name, c.company, c.role, c.email, c.notes].some((field) => field.toLowerCase().includes(q))),
    );
  }, [contacts, search, scope]);

  const applicationById = new Map(applications.map((a) => [a.id, a]));
  const companies = new Set(contacts.map((c) => c.company.trim().toLowerCase()).filter(Boolean)).size;

  return (
    <Page>
      <PageHeader
        title="Networking"
        description={contacts.length === 0 ? "Recruiters, alumni and engineers you've met, or want to." : `${contacts.length} ${contacts.length === 1 ? "person" : "people"} across ${companies} ${companies === 1 ? "company" : "companies"}`}
        actions={
          <Button variant="primary" icon={IconPlus} onClick={() => setEditing("new")}>
            Add contact
          </Button>
        }
      />

      {contacts.length === 0 ? (
        <Card>
          <EmptyState
            icon={IconUsers}
            title="No contacts yet"
            description="Add the people you meet at career fairs, coffee chats and interviews, then link them to the applications they relate to."
            actions={
              <Button variant="primary" icon={IconPlus} onClick={() => setEditing("new")}>
                Add your first contact
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative sm:w-80">
              <Input icon={IconSearch} type="search" aria-label="Search contacts" placeholder="Search name, company, role, notes" value={search} onChange={(e) => setSearch(e.target.value)} className="pr-8 [&::-webkit-search-cancel-button]:hidden" />
              {search && (
                <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-fg-faint hover:text-fg">
                  <IconX size={14} />
                </button>
              )}
            </div>
            <Segmented
              label="Show"
              value={scope}
              onChange={setScope}
              options={[
                { value: "all", label: "All" },
                { value: "linked", label: "Linked", title: "Linked to at least one application" },
                { value: "unlinked", label: "Not linked", title: "Not linked to any application yet" },
              ]}
            />
          </div>

          <Card className="overflow-hidden">
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[880px] table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-[240px]" />
                  <col className="w-[150px]" />
                  <col className="w-[170px]" />
                  <col />
                  <col className="w-[200px]" />
                  <col className="w-[76px]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-line bg-subtle">
                    {["Name", "Company", "Role", "Applications", "Notes"].map((label) => (
                      <th key={label} scope="col" className="h-9 px-3 text-xs font-medium text-fg-muted first:pl-4">
                        {label}
                      </th>
                    ))}
                    <th scope="col" className="sr-only">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState
                          compact
                          icon={IconSearch}
                          title="Nobody matches"
                          description={search ? `No one matches “${search}”.` : "No contacts in this view."}
                          actions={
                            <Button
                              size="sm"
                              onClick={() => {
                                setSearch("");
                                setScope("all");
                              }}
                            >
                              Clear filters
                            </Button>
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    filtered.map((contact) => (
                      <tr key={contact.id} onClick={() => setEditing(contact)} className="group h-14 cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-subtle">
                        <td className="pr-3 pl-4">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Avatar name={contact.name} size={30} />
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditing(contact);
                                }}
                                className="block max-w-full truncate rounded text-left text-ui font-medium text-fg"
                              >
                                {contact.name}
                              </button>
                              {contact.email && <p className="truncate text-xs text-fg-muted">{contact.email}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="truncate px-3 text-ui text-fg-2">{contact.company || <span className="text-fg-faint">—</span>}</td>
                        <td className="truncate px-3 text-ui text-fg-muted">{contact.role || <span className="text-fg-faint">—</span>}</td>
                        <td className="px-3" onClick={(e) => e.stopPropagation()}>
                          {contact.applicationIds.length === 0 ? (
                            <span className="text-ui text-fg-faint">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {contact.applicationIds.map((id) => {
                                const app = applicationById.get(id);
                                if (!app) return null;
                                return (
                                  <button
                                    key={id}
                                    type="button"
                                    onClick={() => onNavigate("detail", id)}
                                    title={`${app.company} · ${app.position}`}
                                    className="inline-flex h-6 max-w-full items-center gap-1.5 rounded-full border border-line bg-surface pr-2 pl-1 text-xs text-fg-2 transition-colors hover:border-line-strong hover:text-fg"
                                  >
                                    <CompanyLogo name={app.company} initials={app.logoInitials} color={app.logoColor} size={16} />
                                    <span className="truncate">{app.position}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </td>
                        <td className="truncate px-3 text-ui text-fg-muted" title={contact.notes}>
                          {contact.notes || <span className="text-fg-faint">—</span>}
                        </td>
                        <td className="pr-3">
                          <div className="flex items-center justify-end gap-0.5">
                            {contact.email && (
                              <a
                                href={`mailto:${contact.email}`}
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`Email ${contact.name}`}
                                title={`Email ${contact.email}`}
                                className="rounded-md p-1.5 text-fg-muted opacity-0 transition-[opacity,background-color] group-hover:opacity-100 hover:bg-muted hover:text-fg focus-visible:opacity-100 max-lg:opacity-100"
                              >
                                <IconMail size={15} />
                              </a>
                            )}
                            <IconChevronRight size={16} className="text-fg-faint transition-colors group-hover:text-fg-muted" />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {editing && <ContactModal contact={editing === "new" ? null : editing} applications={applications} onClose={() => setEditing(null)} />}
    </Page>
  );
}

function ContactModal({ contact, applications, onClose }: { contact: Contact | null; applications: Application[]; onClose: () => void }) {
  const { addContact, updateContact, deleteContact, setContactApplications } = useData();
  const { toast, confirm } = useFeedback();
  const [form, setForm] = useState<ContactInput>(contact ? { name: contact.name, role: contact.role, company: contact.company, email: contact.email, phone: contact.phone, notes: contact.notes } : EMPTY);
  const [linkedIds, setLinkedIds] = useState<string[]>(contact?.applicationIds ?? []);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof ContactInput, value: string) => setForm((f) => ({ ...f, [field]: value }));
  const toggleLink = (id: string) => setLinkedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const nameError = form.name.trim() ? null : "A name is required.";
  const emailError = form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim()) ? "That doesn't look like an email address." : null;

  // Applications at this contact's company first — usually the ones you want.
  const sortedApplications = [...applications].sort(
    (a, b) => Number(b.company.toLowerCase() === form.company.toLowerCase()) - Number(a.company.toLowerCase() === form.company.toLowerCase()) || a.company.localeCompare(b.company),
  );

  const save = async () => {
    setTouched(true);
    if (nameError || emailError) return;
    setSaving(true);
    setError(null);
    try {
      if (contact) {
        await updateContact(contact.id, form);
        await setContactApplications(contact.id, linkedIds);
      } else {
        await addContact(form, linkedIds);
      }
      toast(contact ? "Contact saved" : `Added ${form.name.trim()}`);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!contact) return;
    if (!(await confirm({ title: `Delete ${contact.name}?`, message: "This also removes their links to applications. It can't be undone.", confirmLabel: "Delete", tone: "danger" }))) return;
    setSaving(true);
    try {
      await deleteContact(contact.id);
      toast(`Deleted ${contact.name}`);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <Modal
      size="lg"
      title={contact ? contact.name : "New contact"}
      description={contact ? [contact.role, contact.company].filter(Boolean).join(" · ") || "Update their details or linked applications" : "Someone you've talked to, or want to reach out to."}
      onClose={onClose}
      dismissible={!saving}
      footer={
        <>
          {contact && (
            <Button variant="danger-ghost" icon={IconTrash} onClick={remove} disabled={saving} className="mr-auto">
              Delete
            </Button>
          )}
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={saving}>
            {contact ? "Save changes" : "Add contact"}
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
          <Field label="Name" required error={touched ? nameError : null}>
            <Input data-autofocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Sarah Chen" autoComplete="off" />
          </Field>
          <Field label="Company">
            <Input value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="e.g. Acme Corp" />
          </Field>
          <Field label="Role">
            <Input value={form.role} onChange={(e) => set("role", e.target.value)} placeholder="e.g. University Recruiter" />
          </Field>
          <Field label="Email" error={touched ? emailError : null}>
            <Input icon={IconMail} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="name@company.com" autoComplete="off" />
          </Field>
          <Field label="Phone" hint="Optional">
            <Input icon={IconPhone} type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(555) 123-4567" />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="How you met, what you discussed, what to follow up on…" />
        </Field>

        <fieldset>
          <legend className="mb-1.5 flex w-full items-baseline justify-between text-ui font-medium text-fg-2">
            Linked applications
            {linkedIds.length > 0 && <span className="text-xs font-normal text-fg-muted">{linkedIds.length} linked</span>}
          </legend>
          {applications.length === 0 ? (
            <p className="text-ui text-fg-muted">You don't have any applications yet.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-md border border-line p-1">
              {sortedApplications.map((app) => {
                const checked = linkedIds.includes(app.id);
                return (
                  <label key={app.id} className={cx("flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted", checked && "bg-subtle")}>
                    <Checkbox checked={checked} onChange={() => toggleLink(app.id)} />
                    <CompanyLogo name={app.company} initials={app.logoInitials} color={app.logoColor} size={20} />
                    <span className="min-w-0 flex-1 truncate text-ui text-fg">
                      {app.company}
                      <span className="text-fg-muted"> · {app.position}</span>
                    </span>
                    <StatusDot status={app.status} />
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>
        <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}
