import { useEffect, useMemo, useState } from "react";
import { useData, type ContactInput } from "../data/DataContext";
import type { Application, Contact } from "../data/types";

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
    if (!q) return contacts;
    return contacts.filter((c) =>
      [c.name, c.company, c.role, c.email, c.notes].some((field) => field.toLowerCase().includes(q)),
    );
  }, [contacts, search]);

  const applicationById = new Map(applications.map((a) => [a.id, a]));

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "1.5rem", fontWeight: 700, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
            Networking
          </h1>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--muted-foreground)", marginTop: "2px" }}>
            {contacts.length === 0
              ? "People you've talked to, or want to reach out to"
              : `${filtered.length} of ${contacts.length} ${contacts.length === 1 ? "person" : "people"}`}
          </p>
        </div>
        <button
          onClick={() => setEditing("new")}
          style={{ background: "var(--primary)", color: "white", border: "none", borderRadius: "8px", padding: "8px 14px", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.88")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add Contact
        </button>
      </div>

      {/* Search */}
      {contacts.length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "10px", padding: "10px 14px", marginBottom: "12px" }}>
          <div style={{ position: "relative" }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)", pointerEvents: "none" }}>
              <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4" />
              <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search name, company, role, notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%", paddingLeft: "30px", paddingRight: "10px", paddingTop: "7px", paddingBottom: "7px",
                fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--foreground)",
                background: "var(--muted)", border: "1px solid var(--border)", borderRadius: "7px",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
        {contacts.length === 0 ? (
          <EmptyState onAdd={() => setEditing("new")} />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "200px" }} />
              <col style={{ width: "170px" }} />
              <col style={{ width: "190px" }} />
              <col style={{ width: "230px" }} />
              <col style={{ width: "220px" }} />
              <col style={{ width: "44px" }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)" }}>
                {["Name", "Company", "Position", "Applications", "Notes"].map((label) => (
                  <th
                    key={label}
                    style={{
                      fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.75rem",
                      color: "var(--muted-foreground)", padding: "10px 14px", textAlign: "left",
                      letterSpacing: "0.02em", textTransform: "uppercase", whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "40px", textAlign: "center" }}>
                    <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
                      Nobody matches that search.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((contact, i) => (
                  <tr
                    key={contact.id}
                    onClick={() => setEditing(contact)}
                    style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer", transition: "background 0.1s" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "var(--muted)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
                  >
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div
                          style={{
                            width: "26px", height: "26px", borderRadius: "50%", flexShrink: 0,
                            background: "var(--accent)", color: "var(--accent-foreground)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "0.625rem",
                          }}
                        >
                          {initialsOf(contact.name)}
                        </div>
                        <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.8375rem", color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {contact.name}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <Truncated>{contact.company || "—"}</Truncated>
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <Truncated>{contact.role || "—"}</Truncated>
                    </td>
                    <td style={{ padding: "11px 14px" }} onClick={(e) => e.stopPropagation()}>
                      {contact.applicationIds.length === 0 ? (
                        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--muted-foreground)" }}>—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {contact.applicationIds.map((id) => {
                            const app = applicationById.get(id);
                            if (!app) return null;
                            return (
                              <button
                                key={id}
                                onClick={() => onNavigate("detail", id)}
                                title={`${app.company} — ${app.position}`}
                                style={{
                                  background: app.logoColor + "22", color: app.logoColor,
                                  border: `1px solid ${app.logoColor}44`, borderRadius: "100px",
                                  padding: "2px 8px", fontFamily: "var(--font-body)", fontSize: "0.6875rem",
                                  fontWeight: 500, cursor: "pointer", maxWidth: "100%",
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                }}
                              >
                                {app.position}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <Truncated muted>{contact.notes || "—"}</Truncated>
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "right", color: "var(--muted-foreground)" }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <ContactModal
          contact={editing === "new" ? null : editing}
          applications={applications}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Truncated({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-body)", fontSize: "0.8rem",
        color: muted ? "var(--muted-foreground)" : "var(--foreground)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block",
      }}
    >
      {children}
    </span>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ padding: "56px 24px", textAlign: "center" }}>
      <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="7.5" cy="7" r="3" stroke="var(--primary)" strokeWidth="1.5" />
          <path d="M2.5 16c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M14 8.5a2.5 2.5 0 1 0-1.5-4.5M15 15.5c0-1.9-.9-3.5-2.3-4.3" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <p style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.9375rem", color: "var(--foreground)", marginBottom: "4px" }}>
        No contacts yet
      </p>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--muted-foreground)", marginBottom: "16px" }}>
        Add recruiters, alumni and engineers you've met — then link them to the applications they relate to.
      </p>
      <button
        onClick={onAdd}
        style={{ background: "var(--primary)", color: "white", border: "none", borderRadius: "8px", padding: "9px 18px", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer" }}
      >
        Add your first contact
      </button>
    </div>
  );
}

function ContactModal({
  contact,
  applications,
  onClose,
}: {
  contact: Contact | null;
  applications: Application[];
  onClose: () => void;
}) {
  const { addContact, updateContact, deleteContact, setContactApplications } = useData();
  const [form, setForm] = useState<ContactInput>(
    contact
      ? { name: contact.name, role: contact.role, company: contact.company, email: contact.email, phone: contact.phone, notes: contact.notes }
      : EMPTY,
  );
  const [linkedIds, setLinkedIds] = useState<string[]>(contact?.applicationIds ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof ContactInput, value: string) => setForm((f) => ({ ...f, [field]: value }));
  const toggleLink = (id: string) =>
    setLinkedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  // Applications at this contact's company first — usually the ones you want.
  const sortedApplications = [...applications].sort(
    (a, b) =>
      Number(b.company.toLowerCase() === form.company.toLowerCase()) -
        Number(a.company.toLowerCase() === form.company.toLowerCase()) || a.company.localeCompare(b.company),
  );

  const save = async () => {
    if (!form.name.trim()) {
      setError("A name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (contact) {
        await updateContact(contact.id, form);
        await setContactApplications(contact.id, linkedIds);
      } else {
        await addContact(form, linkedIds);
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!contact || !confirm(`Delete ${contact.name}? This also removes their links to applications.`)) return;
    setSaving(true);
    try {
      await deleteContact(contact.id);
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
      <div style={{ background: "var(--card)", borderRadius: "16px", border: "1px solid var(--border)", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", width: "100%", maxWidth: "560px", maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "var(--card)", borderRadius: "16px 16px 0 0", zIndex: 1 }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.125rem", fontWeight: 700, color: "var(--foreground)", letterSpacing: "-0.01em" }}>
              {contact ? contact.name : "New Contact"}
            </h2>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--muted-foreground)", marginTop: "2px" }}>
              {contact ? "Update their details or which applications they relate to" : "Someone you've talked to, or want to reach out to"}
            </p>
          </div>
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
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Name" required value={form.name} onChange={(v) => set("name", v)} placeholder="e.g. Sarah Chen" />
            <Field label="Company" value={form.company} onChange={(v) => set("company", v)} placeholder="e.g. Acme Corp" />
            <Field label="Position" value={form.role} onChange={(v) => set("role", v)} placeholder="e.g. University Recruiter" />
            <Field label="Email" value={form.email} onChange={(v) => set("email", v)} placeholder="name@company.com" type="email" />
            <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} placeholder="Optional" />
          </div>

          <div className="mb-4">
            <label style={labelStyle}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={4}
              placeholder="How you met, what you discussed, what to follow up on…"
              style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.6 }}
            />
          </div>

          <div className="mb-6">
            <label style={labelStyle}>Linked applications</label>
            {applications.length === 0 ? (
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--muted-foreground)" }}>
                You don't have any applications yet.
              </p>
            ) : (
              <div style={{ maxHeight: "168px", overflowY: "auto", border: "1px solid var(--border)", borderRadius: "8px", padding: "6px" }}>
                {sortedApplications.map((app) => (
                  <label
                    key={app.id}
                    style={{ display: "flex", alignItems: "center", gap: "10px", padding: "7px 8px", borderRadius: "6px", cursor: "pointer" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLLabelElement).style.background = "var(--muted)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLLabelElement).style.background = "transparent")}
                  >
                    <input
                      type="checkbox"
                      checked={linkedIds.includes(app.id)}
                      onChange={() => toggleLink(app.id)}
                      style={{ accentColor: "var(--primary)", width: "14px", height: "14px", cursor: "pointer" }}
                    />
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--foreground)" }}>
                      {app.company}
                      <span style={{ color: "var(--muted-foreground)" }}> · {app.position}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
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
              {saving ? "Saving…" : contact ? "Save changes" : "Add contact"}
            </button>
            {contact && (
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label style={labelStyle}>
        {label} {required && <span style={{ color: "#EF4444" }}>*</span>}
      </label>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={fieldStyle} />
    </div>
  );
}
