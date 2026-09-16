import { useState } from "react";
import NavBar from "./components/NavBar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Pipeline from "./pages/Pipeline";
import ApplicationsTable from "./pages/ApplicationsTable";
import ApplicationDetail from "./pages/ApplicationDetail";
import AddApplication from "./pages/AddApplication";

type Screen = "dashboard" | "pipeline" | "applications" | "detail" | "add" | "calendar" | "networking" | "ai-coach";

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [detailId, setDetailId] = useState<string>("1");

  const navigate = (newScreen: string, id?: string) => {
    if (newScreen === "detail" && id) setDetailId(id);
    setScreen(newScreen as Screen);
  };

  if (!authed) {
    return <Login onLogin={() => setAuthed(true)} />;
  }

  const isAddOpen = screen === "add";

  return (
    <div style={{ minHeight: "100%", background: "var(--background)" }}>
      <NavBar activeScreen={screen} onNavigate={navigate} onLogout={() => setAuthed(false)} />
      <main style={{ minHeight: "calc(100vh - 56px)" }}>
        {screen === "dashboard" && <Dashboard onNavigate={navigate} />}
        {(screen === "pipeline" || isAddOpen) && <Pipeline onNavigate={navigate} />}
        {screen === "applications" && <ApplicationsTable onNavigate={navigate} />}
        {screen === "detail" && <ApplicationDetail appId={detailId} onNavigate={navigate} />}
        {(screen === "calendar" || screen === "networking" || screen === "ai-coach") && (
          <PlaceholderScreen
            label={screen === "ai-coach" ? "AI Coach" : screen.charAt(0).toUpperCase() + screen.slice(1)}
            onNavigate={navigate}
          />
        )}
      </main>
      {isAddOpen && <AddApplication onNavigate={navigate} />}
    </div>
  );
}

function PlaceholderScreen({ label, onNavigate }: { label: string; onNavigate: (s: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 56px)", gap: "12px" }}>
      <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "4px" }}>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <rect x="3" y="3" width="7" height="7" rx="2" stroke="var(--primary)" strokeWidth="1.5" />
          <rect x="12" y="3" width="7" height="7" rx="2" stroke="var(--primary)" strokeWidth="1.5" />
          <rect x="3" y="12" width="7" height="7" rx="2" stroke="var(--primary)" strokeWidth="1.5" />
          <rect x="12" y="12" width="7" height="7" rx="2" stroke="var(--primary)" strokeWidth="1.5" />
        </svg>
      </div>
      <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.25rem", fontWeight: 700, color: "var(--foreground)", letterSpacing: "-0.02em" }}>{label}</h2>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--muted-foreground)" }}>This section is coming soon.</p>
      <button onClick={() => onNavigate("dashboard")} style={{ marginTop: "8px", fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--primary)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
        ← Back to Dashboard
      </button>
    </div>
  );
}
