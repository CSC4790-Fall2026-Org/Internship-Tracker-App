import { useState, useMemo } from "react";
import type { AppStatus } from "../data/types";
import { useData } from "../data/DataContext";
import { toDate } from "../data/dates";

const STATUS_META: Record<AppStatus, { label: string; color: string; bg: string }> = {
  wishlist:     { label: "Wishlist",      color: "#64748B", bg: "#F1F5F9" },
  applied:      { label: "Applied",       color: "#2563EB", bg: "#DBEAFE" },
  interviewing: { label: "Interviewing",  color: "#D97706", bg: "#FEF3C7" },
  offer:        { label: "Offer",         color: "#059669", bg: "#DCFCE7" },
  rejected:     { label: "Closed",        color: "#DC2626", bg: "#FEE2E2" },
};

type SortField = "company" | "position" | "status" | "appliedDate" | "deadline" | "salary" | "location";

interface ApplicationsTableProps {
  onNavigate: (screen: string, id?: string) => void;
}

export default function ApplicationsTable({ onNavigate }: ApplicationsTableProps) {
  const { applications, deleteApplications } = useData();
  const [deleting, setDeleting] = useState(false);
  const [sortField, setSortField] = useState<SortField>("deadline");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterStatus, setFilterStatus] = useState<AppStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    let rows = [...applications];
    if (filterStatus !== "all") rows = rows.filter((a) => a.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((a) =>
        a.company.toLowerCase().includes(q) ||
        a.position.toLowerCase().includes(q) ||
        a.location.toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => {
      const av: string = (a as unknown as Record<string, string>)[sortField] ?? "";
      const bv: string = (b as unknown as Record<string, string>)[sortField] ?? "";
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [applications, sortField, sortDir, filterStatus, search]);

  const handleDelete = async () => {
    const n = selectedIds.size;
    if (!confirm(`Delete ${n} application${n === 1 ? "" : "s"}? This also removes their interview stages and contacts.`)) return;
    setDeleting(true);
    try {
      await deleteApplications([...selectedIds]);
      setSelectedIds(new Set());
    } catch (e) {
      alert(`Couldn't delete: ${(e as Error).message}`);
    } finally {
      setDeleting(false);
    }
  };

  const allSelected = filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((r) => r.id)));
  };
  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <svg
      width="10" height="10" viewBox="0 0 10 10" fill="none"
      style={{
        marginLeft: "4px", flexShrink: 0,
        opacity: sortField === field ? 1 : 0.3,
        transform: sortField === field && sortDir === "desc" ? "rotate(180deg)" : "none",
        transition: "transform 0.15s",
      }}
    >
      <path d="M5 2v6M2 5l3-3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const thStyle = (field: SortField): React.CSSProperties => ({
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: "0.75rem",
    color: sortField === field ? "var(--primary)" : "var(--muted-foreground)",
    padding: "10px 14px",
    textAlign: "left",
    letterSpacing: "0.02em",
    textTransform: "uppercase",
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
    background: "transparent",
    border: "none",
    width: "100%",
    display: "flex",
    alignItems: "center",
  });

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "1.5rem", fontWeight: 700, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
            Applications
          </h1>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--muted-foreground)", marginTop: "2px" }}>
            {filtered.length} of {applications.length} applications
            {selectedIds.size > 0 && <span style={{ color: "var(--primary)", marginLeft: "6px" }}>· {selectedIds.size} selected</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{ opacity: deleting ? 0.6 : 1, background: "#FEE2E2", color: "#DC2626", border: "1px solid #FCA5A544", borderRadius: "7px", padding: "7px 12px", fontFamily: "var(--font-body)", fontSize: "0.8rem", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 3h8M5 3V2h2v1M4 3v7h4V3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {deleting ? "Deleting…" : `Delete ${selectedIds.size}`}
            </button>
          )}
          <button
            style={{ background: "var(--muted)", border: "1px solid var(--border)", borderRadius: "7px", padding: "7px 12px", fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--muted-foreground)", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4h8M2 8h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M9 6l2 2-2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Export CSV
          </button>
          <button
            onClick={() => onNavigate("add")}
            style={{ background: "var(--primary)", color: "white", border: "none", borderRadius: "8px", padding: "8px 14px", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.88")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add Application
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div
        style={{
          background: "var(--card)", border: "1px solid var(--border)", borderRadius: "10px",
          padding: "10px 14px", marginBottom: "12px",
          display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)", pointerEvents: "none" }}>
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4" />
            <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search company, position, location…"
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

        <div style={{ width: "1px", height: "24px", background: "var(--border)" }} />

        {/* Status filter pills */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--muted-foreground)", marginRight: "2px" }}>Status:</span>
          {[{ id: "all" as const, label: "All" }, ...Object.entries(STATUS_META).map(([id, m]) => ({ id: id as AppStatus, label: m.label }))].map((opt) => {
            const isActive = filterStatus === opt.id;
            const meta = opt.id !== "all" ? STATUS_META[opt.id] : null;
            return (
              <button
                key={opt.id}
                onClick={() => setFilterStatus(opt.id)}
                style={{
                  fontFamily: "var(--font-body)", fontSize: "0.75rem", fontWeight: isActive ? 600 : 400,
                  padding: "3px 9px", borderRadius: "100px",
                  border: isActive ? `1px solid ${meta?.color ?? "var(--primary)"}55` : "1px solid transparent",
                  background: isActive ? (meta?.bg ?? "var(--accent)") : "transparent",
                  color: isActive ? (meta?.color ?? "var(--primary)") : "var(--muted-foreground)",
                  cursor: "pointer", transition: "all 0.12s",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "40px" }} />
            <col style={{ width: "180px" }} />
            <col style={{ width: "220px" }} />
            <col style={{ width: "130px" }} />
            <col style={{ width: "110px" }} />
            <col style={{ width: "110px" }} />
            <col style={{ width: "160px" }} />
            <col style={{ width: "90px" }} />
            <col style={{ width: "44px" }} />
          </colgroup>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)" }}>
              {/* Checkbox */}
              <th style={{ padding: "10px 0 10px 14px" }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  style={{ accentColor: "var(--primary)", width: "14px", height: "14px", cursor: "pointer" }}
                />
              </th>
              {(
                [
                  { label: "Company", field: "company" as SortField },
                  { label: "Position", field: "position" as SortField },
                  { label: "Status", field: "status" as SortField },
                  { label: "Applied", field: "appliedDate" as SortField },
                  { label: "Deadline", field: "deadline" as SortField },
                  { label: "Location", field: "location" as SortField },
                  { label: "Salary", field: "salary" as SortField },
                ] as { label: string; field: SortField }[]
              ).map((col) => (
                <th key={col.field} style={{ padding: 0 }}>
                  <button style={thStyle(col.field)} onClick={() => handleSort(col.field)}>
                    {col.label}
                    <SortIcon field={col.field} />
                  </button>
                </th>
              ))}
              <th style={{ padding: "10px 14px", width: "44px" }} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: "48px", textAlign: "center" }}>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
                    No applications match your filters.
                  </p>
                </td>
              </tr>
            ) : (
              filtered.map((app, i) => {
                const meta = STATUS_META[app.status];
                const isSelected = selectedIds.has(app.id);
                return (
                  <tr
                    key={app.id}
                    style={{
                      borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                      background: isSelected ? "var(--accent)" : "transparent",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = "var(--muted)"; }}
                    onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                  >
                    {/* Checkbox */}
                    <td style={{ padding: "11px 0 11px 14px" }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(app.id)}
                        style={{ accentColor: "var(--primary)", width: "14px", height: "14px", cursor: "pointer" }}
                      />
                    </td>

                    {/* Company */}
                    <td style={{ padding: "11px 14px", cursor: "pointer" }} onClick={() => onNavigate("detail", app.id)}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div
                          style={{
                            width: "26px", height: "26px", borderRadius: "6px", flexShrink: 0,
                            background: app.logoColor + "22", border: `1.5px solid ${app.logoColor}44`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "0.6rem", color: app.logoColor,
                          }}
                        >
                          {app.logoInitials}
                        </div>
                        <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.8375rem", color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {app.company}
                        </span>
                      </div>
                    </td>

                    {/* Position */}
                    <td style={{ padding: "11px 14px", cursor: "pointer" }} onClick={() => onNavigate("detail", app.id)}>
                      <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8375rem", color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                        {app.position}
                      </span>
                    </td>

                    {/* Status */}
                    <td style={{ padding: "11px 14px" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-body)", fontSize: "0.75rem", fontWeight: 600,
                          padding: "3px 9px", borderRadius: "100px",
                          background: meta.bg, color: meta.color, whiteSpace: "nowrap",
                        }}
                      >
                        {meta.label}
                      </span>
                    </td>

                    {/* Applied */}
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ fontFamily: "var(--font-mono-base)", fontSize: "0.8rem", color: "var(--muted-foreground)" }}>
                        {app.appliedDate ? toDate(app.appliedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—"}
                      </span>
                    </td>

                    {/* Deadline */}
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ fontFamily: "var(--font-mono-base)", fontSize: "0.8rem", color: "var(--muted-foreground)" }}>
                        {app.deadline ? toDate(app.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—"}
                      </span>
                    </td>

                    {/* Location */}
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                        {app.location || "—"}
                      </span>
                    </td>

                    {/* Salary */}
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ fontFamily: "var(--font-mono-base)", fontSize: "0.8rem", color: app.salary ? "var(--foreground)" : "var(--muted-foreground)", fontWeight: app.salary ? 500 : 400 }}>
                        {app.salary || "—"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "11px 14px", textAlign: "right" }}>
                      <button
                        onClick={() => onNavigate("detail", app.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", padding: "4px", borderRadius: "5px", display: "inline-flex", alignItems: "center" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--primary)"; (e.currentTarget as HTMLButtonElement).style.background = "var(--accent)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted-foreground)"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Footer */}
        <div
          style={{
            borderTop: "1px solid var(--border)", padding: "10px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "var(--muted)",
          }}
        >
          <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
            Showing {filtered.length} of {applications.length} applications
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {Object.entries(STATUS_META).map(([id, meta]) => {
              const n = applications.filter((a) => a.status === id).length;
              return (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: meta.color, display: "inline-block" }} />
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--muted-foreground)" }}>{meta.label} {n}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
