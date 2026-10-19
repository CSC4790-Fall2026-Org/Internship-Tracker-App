import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useData } from "../data/DataContext";
import { attentionItems } from "../data/insights";
import { Avatar, cx, IconButton, Kbd, Ticker } from "./ui";
import { Menu, useDialogBehavior } from "./overlay";
import { useTheme } from "../lib/theme";
import {
  IconBoard,
  IconBriefcase,
  IconCalendar,
  IconChevronDown,
  IconDashboard,
  IconList,
  IconLogOut,
  IconMenu,
  IconMoon,
  IconPlus,
  IconProfile,
  IconSearch,
  IconSidebar,
  IconSun,
  IconUsers,
  IconX,
  type IconComponent,
} from "./icons";

interface ShellProps {
  activeScreen: string;
  onNavigate: (screen: string, id?: string) => void;
  onLogout: () => void;
  userName: string;
  userEmail: string;
  onOpenSearch: () => void;
  children: ReactNode;
}

type NavId = "dashboard" | "pipeline" | "applications" | "calendar" | "jobs" | "networking" | "ai-coach";

const NAV: { label: string; items: { id: NavId; label: string; icon: IconComponent }[] }[] = [
  {
    label: "Workspace",
    items: [
      { id: "dashboard", label: "Dashboard", icon: IconDashboard },
      { id: "pipeline", label: "Board", icon: IconBoard },
      { id: "applications", label: "Applications", icon: IconList },
      { id: "calendar", label: "Calendar", icon: IconCalendar },
    ],
  },
  {
    label: "Career",
    items: [
      { id: "jobs", label: "Jobs", icon: IconBriefcase },
      { id: "networking", label: "Networking", icon: IconUsers },
      { id: "ai-coach", label: "Profile", icon: IconProfile },
    ],
  },
];

export function BrandMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center rounded-[7px] bg-accent text-white", className)} style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 15 15" fill="none">
        <circle cx="2.5" cy="7.5" r="2" fill="currentColor" />
        <circle cx="7.5" cy="7.5" r="2" fill="currentColor" fillOpacity="0.72" />
        <circle cx="12.5" cy="7.5" r="2" fill="currentColor" fillOpacity="0.45" />
        <path d="M4.5 7.5h1M9.5 7.5h1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    </span>
  );
}

const COLLAPSE_KEY = "pipeline.sidebar.collapsed";

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Desktop: a fixed sidebar that collapses to a 60px icon rail (button or "[" key) and remembers the choice.
 * Below `lg`: a top bar whose menu button opens the full navigation as a drawer.
 */
export default function AppShell({ activeScreen, onNavigate, onLogout, userName, userEmail, onOpenSearch, children }: ShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const { theme, toggle: onToggleTheme } = useTheme();

  useEffect(() => setDrawerOpen(false), [activeScreen]);

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        // Private mode or blocked storage: the toggle still works for this visit.
      }
      return !c;
    });

  // "[" toggles the sidebar, unless you're typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "[" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || document.querySelector('[aria-modal="true"]')) return;
      e.preventDefault();
      toggleCollapsed();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const shared = {
    activeScreen,
    onLogout,
    userName,
    userEmail,
    theme,
    onToggleTheme,
    onNavigate: (screen: string) => {
      setDrawerOpen(false);
      onNavigate(screen);
    },
    onOpenSearch: () => {
      setDrawerOpen(false);
      onOpenSearch();
    },
  };

  return (
    // --sidebar-w lets other fixed elements (like Profile's save bar) line up with the content column.
    <div className="min-h-dvh bg-canvas" style={{ ["--sidebar-w" as string]: collapsed ? "60px" : "240px" }}>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-w)] flex-col border-r border-line bg-surface transition-[width] duration-200 ease-out lg:flex">
        <SidebarContent {...shared} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      <header className="sticky top-0 z-40 flex h-12 items-center gap-2 border-b border-line bg-surface/95 px-2 backdrop-blur lg:hidden">
        <IconButton icon={IconMenu} label="Open navigation" onClick={() => setDrawerOpen(true)} />
        <button type="button" onClick={() => onNavigate("dashboard")} className="flex items-center gap-2 rounded-md px-1">
          <BrandMark size={22} />
          <span className="text-sm font-semibold tracking-[-0.01em]">Pipeline</span>
        </button>
        <div className="ml-auto flex items-center gap-1">
          <IconButton icon={IconSearch} label="Search" onClick={onOpenSearch} />
          <IconButton icon={IconPlus} label="Add application" onClick={() => onNavigate("add")} />
        </div>
      </header>

      {drawerOpen && (
        <Drawer onClose={() => setDrawerOpen(false)}>
          <SidebarContent {...shared} collapsed={false} />
        </Drawer>
      )}

      <div className="transition-[padding] duration-200 ease-out lg:pl-[var(--sidebar-w)]">
        <main id="main">{children}</main>
      </div>
    </div>
  );
}

function Drawer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogBehavior(ref, onClose);
  return createPortal(
    <div className="fixed inset-0 z-[90] lg:hidden">
      <div className="absolute inset-0 bg-[rgb(16_16_20/0.4)] animate-fade-in" onClick={onClose} />
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Navigation" tabIndex={-1} className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-dialog outline-none animate-slide-in">
        <IconButton icon={IconX} label="Close navigation" onClick={onClose} className="absolute top-3 right-3 z-10" />
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Label shown to the right of a rail icon on hover or keyboard focus. */
function RailTip({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-full z-50 ml-3 -translate-y-1/2 rounded-md bg-inverse px-2 py-1 text-xs font-medium whitespace-nowrap text-white opacity-0 shadow-pop transition-opacity delay-0 duration-100 group-hover:opacity-100 group-hover:delay-150 group-focus-visible:opacity-100"
    >
      {children}
    </span>
  );
}

function SidebarContent({
  activeScreen,
  onNavigate,
  onLogout,
  userName,
  userEmail,
  onOpenSearch,
  collapsed,
  onToggleCollapsed,
  theme,
  onToggleTheme,
}: Omit<ShellProps, "children"> & { collapsed: boolean; onToggleCollapsed?: () => void; theme: "light" | "dark"; onToggleTheme: () => void }) {
  const { applications, tasks, contacts } = useData();
  const attention = attentionItems(applications, tasks);
  const urgent = attention.some((a) => a.severity !== "info");
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  const badgeFor = (id: NavId) => {
    if (id === "dashboard" && attention.length > 0) {
      return { text: attention.length, title: `${attention.length} item${attention.length === 1 ? "" : "s"} need attention`, urgent };
    }
    if (id === "applications" && applications.length > 0) return { text: applications.length, title: `${applications.length} applications` };
    if (id === "networking" && contacts.length > 0) return { text: contacts.length, title: `${contacts.length} contacts` };
    return null;
  };

  const railButton = "tactile group relative flex size-9 items-center justify-center rounded-md";

  return (
    <div className="flex h-full flex-col">
      <div className={cx("flex h-14 shrink-0 items-center", collapsed ? "justify-center" : "justify-between pr-2.5 pl-4")}>
        {!collapsed && (
          <button type="button" onClick={() => onNavigate("dashboard")} className="flex items-center gap-2.5 rounded-md">
            <BrandMark />
            <span className="text-[15px] font-semibold tracking-[-0.015em] text-fg">Pipeline</span>
          </button>
        )}
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className={cx(railButton, "text-fg-muted hover:bg-muted hover:text-fg", !collapsed && "size-8")}
          >
            <IconSidebar size={16} />
            <RailTip>
              {collapsed ? "Expand sidebar" : "Collapse sidebar"} <Kbd className="ml-1 border-white/20 bg-white/10 text-white/80">[</Kbd>
            </RailTip>
          </button>
        )}
      </div>

      {collapsed ? (
        <div className="flex flex-col items-center gap-1 pb-2">
          <button type="button" onClick={onOpenSearch} aria-label="Search" className={cx(railButton, "text-fg-muted hover:bg-muted hover:text-fg")}>
            <IconSearch size={16} />
            <RailTip>Search · {isMac ? "⌘" : "Ctrl"}K</RailTip>
          </button>
          <button type="button" onClick={() => onNavigate("add")} aria-label="Add application" className={cx(railButton, "border border-line text-fg-muted shadow-xs hover:bg-subtle hover:text-fg")}>
            <IconPlus size={16} />
            <RailTip>Add application</RailTip>
          </button>
        </div>
      ) : (
        <div className="flex gap-1.5 px-3 pb-3">
          <button
            type="button"
            onClick={onOpenSearch}
            className="tactile-soft flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-subtle px-2.5 text-ui text-fg-muted hover:border-line-strong hover:text-fg"
          >
            <IconSearch size={15} />
            <span className="flex-1 text-left">Search</span>
            <span className="flex items-center gap-0.5">
              <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <IconButton icon={IconPlus} label="Add application" variant="secondary" onClick={() => onNavigate("add")} />
        </div>
      )}

      {/* The rail never needs to scroll, and a scroll container would clip its tooltips. */}
      <nav aria-label="Main" className={cx("flex-1 pb-3", collapsed ? "px-0" : "overflow-y-auto px-3")}>
        {NAV.map((group, gi) => (
          <div key={group.label} className={cx(collapsed ? "flex flex-col items-center" : "mt-3 first:mt-1")}>
            {collapsed ? gi > 0 && <div className="my-2 h-px w-6 bg-line" aria-hidden="true" /> : <p className="px-2 pb-1.5 text-2xs font-medium text-fg-muted">{group.label}</p>}
            <ul className={collapsed ? "flex flex-col items-center gap-1" : "space-y-px"}>
              {group.items.map((item) => {
                const active = activeScreen === item.id || (activeScreen === "detail" && item.id === "applications");
                const badge = badgeFor(item.id);
                const tone = active ? "bg-muted font-medium text-fg" : "text-fg-2 hover:bg-muted/70 hover:text-fg";
                return (
                  <li key={item.id}>
                    {collapsed ? (
                      <button type="button" onClick={() => onNavigate(item.id)} aria-current={active ? "page" : undefined} aria-label={badge ? `${item.label}, ${badge.title}` : item.label} className={cx(railButton, tone)}>
                        <item.icon size={17} className={active ? "text-accent" : "text-fg-muted group-hover:text-fg-2"} />
                        {badge && "urgent" in badge && <span className={cx("absolute top-1.5 right-1.5 size-2 rounded-full ring-2 ring-surface", badge.urgent ? "bg-warning" : "bg-fg-faint")} aria-hidden="true" />}
                        <RailTip>
                          {item.label}
                          {badge && <span className="ml-1.5 text-white/60 tabular-nums">{badge.text}</span>}
                        </RailTip>
                      </button>
                    ) : (
                      <button type="button" onClick={() => onNavigate(item.id)} aria-current={active ? "page" : undefined} className={cx("tactile-soft group flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-ui", tone)}>
                        <item.icon size={16} className={active ? "text-accent" : "text-fg-muted group-hover:text-fg-2"} />
                        <span className="flex-1 text-left">{item.label}</span>
                        {badge && (
                          <span title={badge.title} className={cx("min-w-5 rounded-full px-1.5 text-center text-2xs font-medium tabular-nums", "urgent" in badge && badge.urgent ? "bg-warning-soft text-warning-fg" : "text-fg-muted")}>
                            <Ticker value={badge.text} />
                          </span>
                        )}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cx("border-t border-line", collapsed ? "flex justify-center py-2" : "p-2")}>
        <Menu
          align="start"
          placement="top"
          items={[
            { label: "Profile & resume", icon: IconProfile, onSelect: () => onNavigate("ai-coach") },
            theme === "dark" ? { label: "Light mode", icon: IconSun, onSelect: onToggleTheme } : { label: "Dark mode", icon: IconMoon, onSelect: onToggleTheme },
            "divider",
            { label: "Sign out", icon: IconLogOut, onSelect: onLogout },
          ]}
          trigger={(props) =>
            collapsed ? (
              <button type="button" {...props} aria-label={`Account: ${userName}`} className={cx(railButton, "hover:bg-muted")}>
                <Avatar name={userName} size={28} />
                <RailTip>{userName}</RailTip>
              </button>
            ) : (
              <button type="button" {...props} className="tactile-soft flex w-full items-center gap-2.5 rounded-md p-1.5 text-left hover:bg-muted">
                <Avatar name={userName} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ui font-medium text-fg">{userName}</span>
                  {userEmail && <span className="block truncate text-2xs text-fg-muted">{userEmail}</span>}
                </span>
                <IconChevronDown size={14} className="text-fg-muted" />
              </button>
            )
          }
        />
      </div>
    </div>
  );
}
