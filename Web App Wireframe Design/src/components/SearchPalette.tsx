import { useEffect, useMemo, useRef, useState } from "react";
import { useData } from "../data/DataContext";
import { toDate } from "../data/dates";

type ResultGroup = "Applications" | "People" | "Tasks" | "Events" | "Go to";

interface Result {
  key: string;
  group: ResultGroup;
  title: string;
  subtitle: string;
  /** Extra text that should match a query without being shown. */
  haystack: string;
  accent: string;
  screen: string;
  targetId?: string;
}

const GROUP_ORDER: ResultGroup[] = ["Applications", "People", "Events", "Tasks", "Go to"];

const PAGES: { label: string; screen: string; hint: string }[] = [
  { label: "Dashboard", screen: "dashboard", hint: "Deadlines, tasks and activity" },
  { label: "Jobs", screen: "jobs", hint: "Recommended jobs and job search" },
  { label: "Board", screen: "pipeline", hint: "Kanban and insights" },
  { label: "Applications", screen: "applications", hint: "Full application table" },
  { label: "Calendar", screen: "calendar", hint: "Month and week views" },
  { label: "Networking", screen: "networking", hint: "Contacts and outreach" },
  { label: "Profile", screen: "ai-coach", hint: "Resume and extracted profile" },
];

/** Case-insensitive match; earlier matches in the title rank higher. */
function scoreOf(query: string, title: string, haystack: string): number {
  const q = query.toLowerCase();
  const t = title.toLowerCase();
  if (t.startsWith(q)) return 0;
  const inTitle = t.indexOf(q);
  if (inTitle > -1) return 1 + inTitle / 100;
  const inHay = haystack.toLowerCase().indexOf(q);
  if (inHay > -1) return 50 + inHay / 100;
  return -1;
}

export default function SearchPalette({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate: (screen: string, id?: string) => void;
}) {
  const { applications, contacts, tasks, events } = useData();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const everything = useMemo<Result[]>(() => {
    const out: Result[] = [];

    for (const app of applications) {
      out.push({
        key: `app-${app.id}`,
        group: "Applications",
        title: `${app.company} — ${app.position}`,
        subtitle: [app.status, app.location].filter(Boolean).join(" · "),
        haystack: [app.notes, app.location, app.salary, app.status].join(" "),
        accent: app.logoColor,
        screen: "detail",
        targetId: app.id,
      });
    }

    for (const contact of contacts) {
      out.push({
        key: `contact-${contact.id}`,
        group: "People",
        title: contact.name,
        subtitle: [contact.role, contact.company].filter(Boolean).join(" · "),
        haystack: [contact.email, contact.phone, contact.notes].join(" "),
        accent: "#0EA5E9",
        screen: "networking",
        targetId: contact.id,
      });
    }

    for (const task of tasks) {
      out.push({
        key: `task-${task.id}`,
        group: "Tasks",
        title: task.text,
        subtitle: [task.company, task.done ? "done" : "open"].filter(Boolean).join(" · "),
        haystack: task.company,
        accent: "#475569",
        screen: "dashboard",
      });
    }

    for (const event of events) {
      out.push({
        key: `event-${event.id}`,
        group: "Events",
        title: event.title,
        subtitle: toDate(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        haystack: event.notes,
        accent: "#1D4ED8",
        screen: "calendar",
        targetId: event.id,
      });
    }

    for (const page of PAGES) {
      out.push({
        key: `page-${page.screen}`,
        group: "Go to",
        title: page.label,
        subtitle: page.hint,
        haystack: page.hint,
        accent: "var(--primary)",
        screen: page.screen,
      });
    }

    return out;
  }, [applications, contacts, tasks, events]);

  const results = useMemo(() => {
    const q = query.trim();
    // With no query, offer the pages as a plain jump list.
    if (!q) return everything.filter((r) => r.group === "Go to");

    return everything
      .map((result) => ({ result, score: scoreOf(q, result.title, result.haystack) }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => a.score - b.score || a.result.title.localeCompare(b.result.title))
      .slice(0, 12)
      .map((r) => r.result);
  }, [everything, query]);

  useEffect(() => setActive(0), [query]);

  // Keep the highlighted row in view when arrowing through a long list.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (result: Result) => {
    onNavigate(result.screen, result.targetId);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) choose(results[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  // Group while keeping one flat index for keyboard navigation.
  let flatIndex = -1;
  const grouped = GROUP_ORDER.map((group) => ({ group, items: results.filter((r) => r.group === group) })).filter(
    (g) => g.items.length > 0,
  );

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", zIndex: 200, display: "flex", justifyContent: "center", paddingTop: "12vh", paddingLeft: "24px", paddingRight: "24px" }}
    >
      <div
        style={{
          background: "var(--card)", border: "1px solid var(--border)", borderRadius: "14px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.22)", width: "100%", maxWidth: "580px",
          height: "fit-content", maxHeight: "70vh", display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Input */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ color: "var(--muted-foreground)", flexShrink: 0 }}>
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search applications, people, events, tasks…"
            style={{
              flex: 1, border: "none", outline: "none", background: "transparent",
              fontFamily: "var(--font-body)", fontSize: "0.9375rem", color: "var(--foreground)",
            }}
          />
          <button
            onClick={onClose}
            style={{ fontFamily: "var(--font-mono-base)", fontSize: "0.6875rem", color: "var(--muted-foreground)", background: "var(--muted)", border: "1px solid var(--border)", borderRadius: "5px", padding: "2px 6px", cursor: "pointer" }}
          >
            esc
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: "auto", padding: "6px" }}>
          {results.length === 0 ? (
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--muted-foreground)", textAlign: "center", padding: "28px 16px" }}>
              Nothing matches “{query}”.
            </p>
          ) : (
            grouped.map(({ group, items }) => (
              <div key={group} style={{ marginBottom: "4px" }}>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em", padding: "8px 10px 4px" }}>
                  {group}
                </p>
                {items.map((result) => {
                  flatIndex += 1;
                  const index = flatIndex;
                  const isActive = index === active;
                  return (
                    <button
                      key={result.key}
                      data-active={isActive}
                      onMouseMove={() => setActive(index)}
                      onClick={() => choose(result)}
                      style={{
                        display: "flex", alignItems: "center", gap: "10px", width: "100%", textAlign: "left",
                        padding: "9px 10px", borderRadius: "8px", border: "none", cursor: "pointer",
                        background: isActive ? "var(--accent)" : "transparent",
                      }}
                    >
                      <span style={{ width: "3px", alignSelf: "stretch", borderRadius: "2px", background: result.accent, flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontFamily: "var(--font-body)", fontSize: "0.8375rem", fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {result.title}
                        </span>
                        {result.subtitle && (
                          <span style={{ display: "block", fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "1px" }}>
                            {result.subtitle}
                          </span>
                        )}
                      </span>
                      {isActive && (
                        <span style={{ fontFamily: "var(--font-mono-base)", fontSize: "0.625rem", color: "var(--muted-foreground)", flexShrink: 0 }}>
                          ↵
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div style={{ borderTop: "1px solid var(--border)", padding: "8px 14px", display: "flex", gap: "14px", background: "var(--muted)" }}>
          {[
            { keys: "↑↓", label: "navigate" },
            { keys: "↵", label: "open" },
            { keys: "esc", label: "close" },
          ].map((hint) => (
            <span key={hint.label} style={{ display: "flex", alignItems: "center", gap: "5px", fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--muted-foreground)" }}>
              <span style={{ fontFamily: "var(--font-mono-base)", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "4px", padding: "1px 5px" }}>
                {hint.keys}
              </span>
              {hint.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
