import { useMemo, useRef, useState } from "react";
import type { Application, AppStatus } from "../data/types";
import { useData } from "../data/DataContext";
import { STATUS, STATUS_ORDER } from "../data/status";
import { formatDate } from "../data/dates";
import { applicationsToCsv, csvToApplications, downloadCsv, exportFilename } from "../data/csv";
import { roleKey } from "../data/jobs";
import { Button, Card, Checkbox, CompanyLogo, cx, DueChip, EmptyState, Input, Page, PageHeader, Select, StatusDot, StatusSelect } from "../components/ui";
import { useFeedback, errorMessage } from "../components/feedback";
import { IconArrowUp, IconChevronRight, IconDownload, IconList, IconPlus, IconSearch, IconTrash, IconUpload, IconX } from "../components/icons";

type SortField = "company" | "position" | "status" | "appliedDate" | "deadline" | "salary" | "location";

const COLUMNS: { label: string; field: SortField; className?: string }[] = [
  { label: "Company", field: "company", className: "w-[200px]" },
  { label: "Position", field: "position" },
  { label: "Status", field: "status", className: "w-[140px]" },
  { label: "Applied", field: "appliedDate", className: "w-[104px]" },
  { label: "Deadline", field: "deadline", className: "w-[112px]" },
  { label: "Location", field: "location", className: "w-[180px]" },
  { label: "Pay", field: "salary", className: "w-[104px]" },
];

/** Rough annualized number for sorting free-text pay like "$42/hr", "$120k" or "$85,000". */
function payValue(salary: string): number | null {
  const match = salary.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(k)?/i);
  if (!match) return null;
  let n = parseFloat(match[1]) * (match[2] ? 1000 : 1);
  if (/hr|hour/i.test(salary) || n < 300) n *= 2080;
  return n;
}

function sortValue(app: Application, field: SortField): string | number | null {
  if (field === "status") return STATUS_ORDER.indexOf(app.status);
  if (field === "salary") return payValue(app.salary);
  const v = app[field];
  return v ? v.toLowerCase() : null;
}

interface ApplicationsTableProps {
  onNavigate: (screen: string, id?: string) => void;
  /** Status filter to start with, e.g. when arriving from a dashboard tile. */
  initialStatus?: string;
}

export default function ApplicationsTable({ onNavigate, initialStatus }: ApplicationsTableProps) {
  const { applications, deleteApplications, importApplications, updateApplication } = useData();
  const { toast, confirm } = useFeedback();
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sortField, setSortField] = useState<SortField>("deadline");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterStatus, setFilterStatus] = useState<AppStatus | "all">(STATUS_ORDER.includes(initialStatus as AppStatus) ? (initialStatus as AppStatus) : "all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<AppStatus, number>;
    for (const a of applications) c[a.status] += 1;
    return c;
  }, [applications]);

  const filtered = useMemo(() => {
    let rows = [...applications];
    if (filterStatus !== "all") rows = rows.filter((a) => a.status === filterStatus);
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((a) => [a.company, a.position, a.location, a.notes].some((f) => f.toLowerCase().includes(q)));
    rows.sort((a, b) => {
      const av = sortValue(a, sortField);
      const bv = sortValue(b, sortField);
      // Blanks sink to the bottom whichever way you sort.
      if (av === null || bv === null) return av === bv ? 0 : av === null ? 1 : -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return (sortDir === "asc" ? cmp : -cmp) || a.company.localeCompare(b.company);
    });
    return rows;
  }, [applications, sortField, sortDir, filterStatus, search]);

  // Selection only counts rows you can see, so filtering never acts on hidden applications.
  const visibleSelected = filtered.filter((a) => selectedIds.has(a.id));
  const allSelected = filtered.length > 0 && visibleSelected.length === filtered.length;
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(filtered.map((r) => r.id)));
  const toggleRow = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleDelete = async () => {
    const ids = visibleSelected.map((a) => a.id);
    const n = ids.length;
    const ok = await confirm({
      title: `Delete ${n} application${n === 1 ? "" : "s"}?`,
      message: "Their interview stages are deleted too, and linked contacts are unlinked. This can't be undone.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteApplications(ids);
      setSelectedIds(new Set());
      toast(`Deleted ${n} application${n === 1 ? "" : "s"}`);
    } catch (e) {
      toast(`Couldn't delete: ${errorMessage(e)}`, { tone: "error" });
    } finally {
      setDeleting(false);
    }
  };

  const moveSelected = async (status: AppStatus) => {
    const targets = visibleSelected.filter((a) => a.status !== status);
    if (targets.length === 0) return;
    try {
      await Promise.all(targets.map((a) => updateApplication(a.id, { status })));
      toast(`Moved ${targets.length} to ${STATUS[status].label}`);
    } catch (e) {
      toast(`Couldn't update every application: ${errorMessage(e)}`, { tone: "error" });
    }
  };

  // Exports the selection if there is one, otherwise whatever the current filters show.
  const handleExport = () => {
    const rows = visibleSelected.length > 0 ? visibleSelected : filtered;
    downloadCsv(applicationsToCsv(rows), exportFilename());
    toast(`Exported ${rows.length} application${rows.length === 1 ? "" : "s"}`);
  };

  const handleImport = async (file: File) => {
    const { rows, skipped, ignoredColumns } = csvToApplications(await file.text());
    const existing = new Set(applications.map((a) => roleKey(a.company, a.position)));
    const seen = new Set<string>();
    const fresh = rows.filter((r) => {
      const key = roleKey(r.company, r.position);
      if (existing.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const duplicates = rows.length - fresh.length;

    const details = [
      skipped > 0 && `${skipped} row${skipped === 1 ? "" : "s"} skipped (missing company or position)`,
      duplicates > 0 && `${duplicates} already tracked, skipped`,
      ignoredColumns.length > 0 && `Columns not imported: ${ignoredColumns.join(", ")}`,
    ].filter(Boolean) as string[];
    const detailList = details.length > 0 && (
      <ul className="mt-3 list-disc space-y-1 pl-4 text-fg-muted">
        {details.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
    );

    if (fresh.length === 0) {
      await confirm({
        title: "Nothing new to import",
        message: (
          <>
            No new applications were found in <span className="font-medium text-fg">{file.name}</span>. The file needs a header row with at least Company and Position columns.
            {detailList}
          </>
        ),
        confirmLabel: "OK",
        acknowledge: true,
      });
      return;
    }
    const ok = await confirm({
      title: `Import ${fresh.length} application${fresh.length === 1 ? "" : "s"}?`,
      message: (
        <>
          From <span className="font-medium text-fg">{file.name}</span>.{detailList}
        </>
      ),
      confirmLabel: "Import",
    });
    if (!ok) return;

    setImporting(true);
    try {
      await importApplications(fresh);
      toast(`Imported ${fresh.length} application${fresh.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast(`Couldn't import: ${errorMessage(e)}`, { tone: "error" });
    } finally {
      setImporting(false);
    }
  };

  const setStatus = (app: Application, status: AppStatus) =>
    updateApplication(app.id, { status }).catch((e) => toast(`Couldn't update ${app.company}: ${errorMessage(e)}`, { tone: "error" }));

  const hasFilters = filterStatus !== "all" || search.trim() !== "";

  return (
    <Page>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // so picking the same file again still fires onChange
          if (file) handleImport(file);
        }}
      />
      <PageHeader
        title="Applications"
        description={applications.length === 0 ? "Every role you're tracking, in one sortable list." : `${applications.length} tracked · ${counts.applied + counts.interviewing} in progress`}
        actions={
          <>
            <Button icon={IconUpload} onClick={() => fileInputRef.current?.click()} loading={importing}>
              Import
            </Button>
            <Button icon={IconDownload} onClick={handleExport} disabled={filtered.length === 0}>
              Export
            </Button>
            <Button variant="primary" icon={IconPlus} onClick={() => onNavigate("add")}>
              Add application
            </Button>
          </>
        }
      />

      {applications.length === 0 ? (
        <Card>
          <EmptyState
            icon={IconList}
            title="No applications yet"
            description="Add the roles you're interested in, or import a CSV from a spreadsheet you've been keeping."
            actions={
              <>
                <Button icon={IconUpload} onClick={() => fileInputRef.current?.click()}>
                  Import CSV
                </Button>
                <Button variant="primary" icon={IconPlus} onClick={() => onNavigate("add")}>
                  Add application
                </Button>
              </>
            }
          />
        </Card>
      ) : (
        <>
          {/* Toolbar */}
          <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative md:w-72">
              <Input icon={IconSearch} type="search" aria-label="Search applications" placeholder="Search company, role, location, notes" value={search} onChange={(e) => setSearch(e.target.value)} className="pr-8 [&::-webkit-search-cancel-button]:hidden" />
              {search && (
                <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-fg-faint hover:text-fg">
                  <IconX size={14} />
                </button>
              )}
            </div>
            <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5" role="group" aria-label="Filter by status">
              {(["all", ...STATUS_ORDER] as const).map((s) => {
                const active = filterStatus === s;
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilterStatus(s)}
                    className={cx(
                      "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-ui transition-colors",
                      active ? "border-fg bg-fg text-on-ink" : "border-line bg-surface text-fg-2 hover:border-line-strong",
                    )}
                  >
                    {s !== "all" && <StatusDot status={s} className={active ? "ring-2 ring-on-ink/30" : undefined} />}
                    {s === "all" ? "All" : STATUS[s].label}
                    <span className={cx("text-xs tabular-nums", active ? "text-on-ink/70" : "text-fg-muted")}>{s === "all" ? applications.length : counts[s]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Card className="overflow-hidden">
            {visibleSelected.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-line bg-accent-soft/60 px-3 py-2" role="region" aria-label="Bulk actions">
                <span className="mr-1 text-ui font-medium text-fg">{visibleSelected.length} selected</span>
                <Select aria-label="Move selected to" value="" onChange={(e) => e.target.value && moveSelected(e.target.value as AppStatus)} className="h-7 bg-surface text-ui" wrapperClassName="w-40">
                  <option value="">Move to…</option>
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {STATUS[s].label}
                    </option>
                  ))}
                </Select>
                <Button size="sm" icon={IconDownload} onClick={handleExport}>
                  Export
                </Button>
                <Button size="sm" variant="danger-ghost" icon={IconTrash} onClick={handleDelete} loading={deleting}>
                  Delete
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="ml-auto">
                  Clear selection
                </Button>
              </div>
            )}

            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[980px] table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-11" />
                  {COLUMNS.map((c) => (
                    <col key={c.field} className={c.className} />
                  ))}
                  <col className="w-10" />
                </colgroup>
                <thead>
                  <tr className="border-b border-line bg-subtle">
                    <th scope="col" className="py-2 pl-4">
                      <Checkbox checked={allSelected} indeterminate={!allSelected && visibleSelected.length > 0} onChange={toggleAll} aria-label="Select all visible applications" />
                    </th>
                    {COLUMNS.map((col) => {
                      const active = sortField === col.field;
                      return (
                        <th key={col.field} scope="col" aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : undefined} className="px-3 py-0">
                          <button
                            type="button"
                            onClick={() => handleSort(col.field)}
                            className={cx("group -mx-1.5 inline-flex h-9 items-center gap-1 rounded px-1.5 text-xs font-medium transition-colors", active ? "text-fg" : "text-fg-muted hover:text-fg")}
                          >
                            {col.label}
                            <IconArrowUp size={12} strokeWidth={2.25} className={cx("transition-[transform,opacity]", active ? "opacity-100" : "opacity-0 group-hover:opacity-40", active && sortDir === "desc" && "rotate-180")} />
                          </button>
                        </th>
                      );
                    })}
                    <th scope="col" className="sr-only">
                      Open
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMNS.length + 2}>
                        <EmptyState
                          compact
                          icon={IconSearch}
                          title="No applications match"
                          description={search ? `Nothing matches “${search}”${filterStatus !== "all" ? ` in ${STATUS[filterStatus].label}` : ""}.` : `You don't have any ${filterStatus !== "all" ? STATUS[filterStatus].label.toLowerCase() : ""} applications.`}
                          actions={
                            hasFilters && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSearch("");
                                  setFilterStatus("all");
                                }}
                              >
                                Clear filters
                              </Button>
                            )
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    filtered.map((app) => {
                      const selected = selectedIds.has(app.id);
                      return (
                        <tr
                          key={app.id}
                          onClick={() => onNavigate("detail", app.id)}
                          className={cx("group h-12 cursor-pointer border-b border-line transition-colors last:border-b-0", selected ? "bg-accent-soft/50" : "hover:bg-subtle")}
                        >
                          <td className="pl-4" onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={selected} onChange={() => toggleRow(app.id)} aria-label={`Select ${app.company} ${app.position}`} />
                          </td>
                          <td className="px-3">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <CompanyLogo name={app.company} initials={app.logoInitials} color={app.logoColor} size={24} />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigate("detail", app.id);
                                }}
                                className="truncate rounded text-ui font-medium text-fg hover:underline hover:underline-offset-2"
                              >
                                {app.company}
                              </button>
                            </div>
                          </td>
                          <td className="truncate px-3 text-ui text-fg-2" title={app.position}>
                            {app.position}
                          </td>
                          <td className="px-3">
                            <StatusSelect value={app.status} onChange={(s) => setStatus(app, s)} label={`Status for ${app.company}`} />
                          </td>
                          <td className="px-3 text-ui text-fg-muted tabular-nums">{app.appliedDate ? formatDate(app.appliedDate) : <span className="text-fg-faint">—</span>}</td>
                          <td className="px-3">
                            {app.deadline ? (
                              app.status === "wishlist" || app.status === "applied" ? (
                                <DueChip date={app.deadline} className="text-ui" />
                              ) : (
                                <span className="text-ui text-fg-muted tabular-nums">{formatDate(app.deadline)}</span>
                              )
                            ) : (
                              <span className="text-ui text-fg-faint">—</span>
                            )}
                          </td>
                          <td className="truncate px-3 text-ui text-fg-muted" title={app.location}>
                            {app.location || <span className="text-fg-faint">—</span>}
                          </td>
                          <td className="truncate px-3 text-ui text-fg-2 tabular-nums">{app.salary || <span className="text-fg-faint">—</span>}</td>
                          <td className="pr-3 text-right">
                            <IconChevronRight size={16} className="inline text-fg-faint transition-colors group-hover:text-fg-muted" />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {filtered.length > 0 && (
              <div className="flex items-center justify-between border-t border-line bg-subtle px-4 py-2 text-xs text-fg-muted">
                <span>
                  {hasFilters ? `${filtered.length} of ${applications.length}` : `${applications.length}`} application{applications.length === 1 ? "" : "s"}
                </span>
                <span className="hidden sm:inline">Click a status to change it · Click a row to open</span>
              </div>
            )}
          </Card>
        </>
      )}
    </Page>
  );
}
