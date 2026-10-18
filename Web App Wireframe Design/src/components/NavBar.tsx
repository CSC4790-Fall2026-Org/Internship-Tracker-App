import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useData } from "../data/DataContext";
import { attentionItems } from "../data/insights";
import { Avatar, cx, IconButton, Kbd } from "./ui";
import { Menu, useDialogBehavior } from "./overlay";
import {
  IconBoard,
  IconBriefcase,
  IconCalendar,
  IconChevronDown,
  IconDashboard,
  IconList,
  IconLogOut,
  IconMenu,
  IconPlus,
  IconProfile,
  IconSearch,
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

/** Desktop: fixed sidebar. Below `lg`: a top bar whose menu button opens the same navigation as a drawer. */
export default function AppShell({ activeScreen, onNavigate, onLogout, userName, userEmail, onOpenSearch, children }: ShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => setDrawerOpen(false), [activeScreen]);

  const sidebar = (
    <SidebarContent
      activeScreen={activeScreen}
      onNavigate={(screen) => {
        setDrawerOpen(false);
        onNavigate(screen);
      }}
      onLogout={onLogout}
      userName={userName}
      userEmail={userEmail}
      onOpenSearch={() => {
        setDrawerOpen(false);
        onOpenSearch();
      }}
    />
  );

  return (
    <div className="min-h-dvh bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-surface lg:flex">{sidebar}</aside>

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

      {drawerOpen && <Drawer onClose={() => setDrawerOpen(false)}>{sidebar}</Drawer>}

      <div className="lg:pl-60">
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

function SidebarContent({ activeScreen, onNavigate, onLogout, userName, userEmail, onOpenSearch }: Omit<ShellProps, "children">) {
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center px-4">
        <button type="button" onClick={() => onNavigate("dashboard")} className="flex items-center gap-2.5 rounded-md">
          <BrandMark />
          <span className="text-[15px] font-semibold tracking-[-0.015em] text-fg">Pipeline</span>
        </button>
      </div>

      <div className="flex gap-1.5 px-3 pb-3">
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-subtle px-2.5 text-ui text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
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

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-3">
        {NAV.map((group) => (
          <div key={group.label} className="mt-3 first:mt-1">
            <p className="px-2 pb-1.5 text-2xs font-medium text-fg-muted">{group.label}</p>
            <ul className="space-y-px">
              {group.items.map((item) => {
                const active = activeScreen === item.id || (activeScreen === "detail" && item.id === "applications");
                const badge = badgeFor(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate(item.id)}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "group flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-ui transition-colors",
                        active ? "bg-muted font-medium text-fg" : "text-fg-2 hover:bg-muted/70 hover:text-fg",
                      )}
                    >
                      <item.icon size={16} className={active ? "text-accent" : "text-fg-muted group-hover:text-fg-2"} />
                      <span className="flex-1 text-left">{item.label}</span>
                      {badge && (
                        <span
                          title={badge.title}
                          className={cx(
                            "min-w-5 rounded-full px-1.5 text-center text-2xs font-medium tabular-nums",
                            "urgent" in badge && badge.urgent ? "bg-warning-soft text-warning-fg" : "text-fg-muted",
                          )}
                        >
                          {badge.text}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-2">
        <Menu
          align="start"
          placement="top"
          items={[
            { label: "Profile & resume", icon: IconProfile, onSelect: () => onNavigate("ai-coach") },
            "divider",
            { label: "Sign out", icon: IconLogOut, onSelect: onLogout },
          ]}
          trigger={(props) => (
            <button type="button" {...props} className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-muted">
              <Avatar name={userName} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ui font-medium text-fg">{userName}</span>
                {userEmail && <span className="block truncate text-2xs text-fg-muted">{userEmail}</span>}
              </span>
              <IconChevronDown size={14} className="text-fg-muted" />
            </button>
          )}
        />
      </div>
    </div>
  );
}
