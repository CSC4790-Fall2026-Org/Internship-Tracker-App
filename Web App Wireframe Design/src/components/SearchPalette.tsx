import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useData } from "../data/DataContext";
import { STATUS } from "../data/status";
import type { AppStatus } from "../data/types";
import { formatDate } from "../data/dates";
import { useDialogBehavior } from "./overlay";
import { CompanyLogo, cx, Kbd, StatusDot } from "./ui";
import {
  IconArrowRight,
  IconBoard,
  IconBriefcase,
  IconCalendar,
  IconDashboard,
  IconList,
  IconPlus,
  IconProfile,
  IconSearch,
  IconTaskSquare,
  IconUsers,
  type IconComponent,
} from "./icons";

type ResultGroup = "Actions" | "Applications" | "People" | "Events" | "Tasks" | "Go to";

interface Result {
  key: string;
  group: ResultGroup;
  title: string;
  subtitle: string;
  /** Extra text that should match a query without being shown. */
  haystack: string;
  screen: string;
  targetId?: string;
  icon?: IconComponent;
  logo?: { color: string; initials: string };
  status?: AppStatus;
}

const GROUP_ORDER: ResultGroup[] = ["Actions", "Applications", "People", "Events", "Tasks", "Go to"];

const PAGES: { label: string; screen: string; hint: string; icon: IconComponent }[] = [
  { label: "Dashboard", screen: "dashboard", hint: "What needs attention, upcoming, pipeline", icon: IconDashboard },
  { label: "Board", screen: "pipeline", hint: "Applications by stage, and insights", icon: IconBoard },
  { label: "Applications", screen: "applications", hint: "Full sortable list, import and export", icon: IconList },
  { label: "Calendar", screen: "calendar", hint: "Month and week views", icon: IconCalendar },
  { label: "Jobs", screen: "jobs", hint: "Matches from your resume and job search", icon: IconBriefcase },
  { label: "Networking", screen: "networking", hint: "Contacts and outreach", icon: IconUsers },
  { label: "Profile", screen: "ai-coach", hint: "Resume and extracted profile", icon: IconProfile },
];

const ACTIONS: Result[] = [
  { key: "action-add", group: "Actions", title: "Add application", subtitle: "Track a new role", haystack: "new create application job", screen: "add", icon: IconPlus },
  { key: "action-calendar", group: "Actions", title: "Open today in the calendar", subtitle: "See what's scheduled", haystack: "today schedule event", screen: "calendar", icon: IconCalendar },
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

export default function SearchPalette({ onClose, onNavigate }: { onClose: () => void; onNavigate: (screen: string, id?: string) => void }) {
  const { applications, contacts, tasks, events } = useData();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogBehavior(panelRef, onClose);

  const everything = useMemo<Result[]>(() => {
    const out: Result[] = [...ACTIONS];
    for (const app of applications) {
      out.push({
        key: `app-${app.id}`,
        group: "Applications",
        title: `${app.company} · ${app.position}`,
        subtitle: [STATUS[app.status].label, app.location].filter(Boolean).join(" · "),
        haystack: [app.notes, app.location, app.salary, STATUS[app.status].label].join(" "),
        screen: "detail",
        targetId: app.id,
        logo: { color: app.logoColor, initials: app.logoInitials },
        status: app.status,
      });
    }
    for (const contact of contacts) {
      out.push({
        key: `contact-${contact.id}`,
        group: "People",
        title: contact.name,
        subtitle: [contact.role, contact.company].filter(Boolean).join(" · "),
        haystack: [contact.email, contact.phone, contact.notes].join(" "),
        screen: "networking",
        targetId: contact.id,
        icon: IconUsers,
      });
    }
    for (const task of tasks) {
      out.push({ key: `task-${task.id}`, group: "Tasks", title: task.text, subtitle: [task.company, task.done ? "Done" : task.due ? `Due ${formatDate(task.due)}` : "Open"].filter(Boolean).join(" · "), haystack: task.company, screen: "dashboard", icon: IconTaskSquare });
    }
    for (const event of events) {
      out.push({ key: `event-${event.id}`, group: "Events", title: event.title, subtitle: formatDate(event.date, { weekday: true }), haystack: event.notes, screen: "calendar", targetId: event.id, icon: IconCalendar });
    }
    for (const page of PAGES) {
      out.push({ key: `page-${page.screen}`, group: "Go to", title: page.label, subtitle: page.hint, haystack: page.hint, screen: page.screen, icon: page.icon });
    }
    return out;
  }, [applications, contacts, tasks, events]);

  const results = useMemo(() => {
    const q = query.trim();
    // With no query, offer actions and the pages as a plain jump list.
    if (!q) return everything.filter((r) => r.group === "Go to" || r.group === "Actions");
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
    onClose();
    onNavigate(result.screen, result.targetId);
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
    }
  };

  // Group while keeping one flat index for keyboard navigation.
  let flatIndex = -1;
  const grouped = GROUP_ORDER.map((group) => ({ group, items: results.filter((r) => r.group === group) })).filter((g) => g.items.length > 0);
  const activeId = results[active] ? `search-${results[active].key}` : undefined;

  return createPortal(
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[200] flex justify-center bg-[rgb(16_16_20/0.42)] px-3 pt-[10vh] animate-fade-in sm:px-6 sm:pt-[14vh]"
    >
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Search" className="flex h-fit max-h-[72vh] w-full max-w-[600px] flex-col overflow-hidden rounded-dialog bg-surface shadow-dialog animate-pop-in">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <IconSearch size={17} className="text-fg-muted" />
          <input
            data-autofocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls="search-results"
            aria-activedescendant={activeId}
            aria-label="Search applications, people, events, tasks"
            placeholder="Search applications, people, events, tasks…"
            className="h-13 flex-1 bg-transparent text-[15px] text-fg placeholder:text-fg-faint focus:outline-none"
          />
          <button type="button" onClick={onClose} className="rounded">
            <Kbd>Esc</Kbd>
          </button>
        </div>

        <div ref={listRef} id="search-results" role="listbox" className="overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <p className="px-4 py-10 text-center text-ui text-fg-muted">Nothing matches “{query}”.</p>
          ) : (
            grouped.map(({ group, items }) => (
              <div key={group} role="group" aria-label={group} className="mb-1 last:mb-0">
                <p className="px-2.5 pt-2 pb-1 text-2xs font-medium text-fg-muted">{group}</p>
                {items.map((result) => {
                  flatIndex += 1;
                  const index = flatIndex;
                  const isActive = index === active;
                  return (
                    <button
                      key={result.key}
                      id={`search-${result.key}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      data-active={isActive}
                      tabIndex={-1}
                      onMouseMove={() => setActive(index)}
                      onClick={() => choose(result)}
                      className={cx("flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left", isActive ? "bg-muted" : "bg-transparent")}
                    >
                      {result.logo ? (
                        <CompanyLogo name={result.title} initials={result.logo.initials} color={result.logo.color} size={26} />
                      ) : (
                        <span className="flex size-[26px] shrink-0 items-center justify-center rounded-md border border-line bg-subtle text-fg-muted">{result.icon && <result.icon size={14} />}</span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-ui font-medium text-fg">{result.title}</span>
                        {result.subtitle && (
                          <span className="flex items-center gap-1.5 truncate text-xs text-fg-muted">
                            {result.status && <StatusDot status={result.status} />}
                            {result.subtitle}
                          </span>
                        )}
                      </span>
                      {isActive && <IconArrowRight size={14} className="text-fg-muted" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex gap-4 border-t border-line bg-subtle px-4 py-2 text-2xs text-fg-muted">
          {[
            { keys: ["↑", "↓"], label: "Navigate" },
            { keys: ["↵"], label: "Open" },
            { keys: ["Esc"], label: "Close" },
          ].map((hint) => (
            <span key={hint.label} className="flex items-center gap-1.5">
              <span className="flex gap-0.5">
                {hint.keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
              {hint.label}
            </span>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
