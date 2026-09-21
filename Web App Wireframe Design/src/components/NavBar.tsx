interface NavBarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
  userName: string;
}

const navItems = [
  { id: "dashboard", label: "Dashboard" },
  { id: "pipeline", label: "Board" },
  { id: "applications", label: "Applications" },
  { id: "calendar", label: "Calendar" },
  { id: "networking", label: "Networking" },
  { id: "ai-coach", label: "AI Coach" },
];

export default function NavBar({ activeScreen, onNavigate, onLogout, userName }: NavBarProps) {
  const initials = userName.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <header
      style={{
        background: "var(--card)",
        borderBottom: "1px solid var(--border)",
        fontFamily: "var(--font-body)",
      }}
      className="sticky top-0 z-50"
    >
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center gap-8">
        {/* Logo */}
        <button
          onClick={() => onNavigate("dashboard")}
          className="flex items-center gap-2.5 shrink-0"
        >
          <div
            style={{ background: "var(--primary)", borderRadius: "8px" }}
            className="w-7 h-7 flex items-center justify-center"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="2.5" cy="7.5" r="2" fill="white" />
              <circle cx="7.5" cy="7.5" r="2" fill="white" fillOpacity="0.7" />
              <circle cx="12.5" cy="7.5" r="2" fill="white" fillOpacity="0.4" />
              <path d="M4.5 7.5h1.5M9.5 7.5h1.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </div>
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "1rem",
              color: "var(--foreground)",
              letterSpacing: "-0.02em",
            }}
          >
            Pipeline
          </span>
        </button>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive =
              activeScreen === item.id ||
              (activeScreen === "detail" && item.id === "pipeline") ||
              (activeScreen === "add" && item.id === "pipeline");
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.8125rem",
                  fontWeight: isActive ? 600 : 450,
                  color: isActive ? "var(--primary)" : "var(--muted-foreground)",
                  background: isActive ? "var(--accent)" : "transparent",
                  borderRadius: "6px",
                  padding: "5px 10px",
                  transition: "all 0.15s ease",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--foreground)";
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--muted)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--muted-foreground)";
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3">
          <button
            style={{
              background: "var(--muted)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "5px 10px",
              fontSize: "0.75rem",
              fontFamily: "var(--font-body)",
              color: "var(--muted-foreground)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9 9l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Search
            <span style={{ fontFamily: "var(--font-mono-base)", fontSize: "0.6875rem", opacity: 0.6 }}>⌘K</span>
          </button>

          {/* Notifications */}
          <button
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "var(--muted)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5a4 4 0 0 0-4 4v2.5l-1 1.5h10l-1-1.5V5.5a4 4 0 0 0-4-4z" stroke="var(--muted-foreground)" strokeWidth="1.3" strokeLinejoin="round" />
              <path d="M5.5 10.5a1.5 1.5 0 0 0 3 0" stroke="var(--muted-foreground)" strokeWidth="1.3" />
            </svg>
          </button>

          {/* Avatar + logout */}
          <div style={{ position: "relative" }}>
            <button
              onClick={onLogout}
              title={`Signed in as ${userName} — click to sign out`}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "#374151",
                border: "2px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: "0.6875rem",
                color: "white",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.8")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
            >
              {initials}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
