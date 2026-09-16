import { useState } from "react";
import { applications, Application, AppStatus } from "../data/mockData";
import SankeyDiagram from "../components/SankeyDiagram";

const STATUS_COLUMNS: { id: AppStatus; label: string; color: string; bg: string }[] = [
  { id: "wishlist", label: "Wishlist", color: "#64748B", bg: "#F1F5F9" },
  { id: "applied", label: "Applied", color: "#2563EB", bg: "#DBEAFE" },
  { id: "interviewing", label: "Interviewing", color: "#D97706", bg: "#FEF3C7" },
  { id: "offer", label: "Offer", color: "#059669", bg: "#DCFCE7" },
  { id: "rejected", label: "Closed", color: "#DC2626", bg: "#FEE2E2" },
];

interface PipelineProps {
  onNavigate: (screen: string, id?: string) => void;
}

function LogoPlaceholder({ initials, color, size = 28 }: { initials: string; color: string; size?: number }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "7px",
        background: color + "22", border: `1.5px solid ${color}44`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-heading)", fontWeight: 700,
        fontSize: size * 0.33, color, flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function PipelineVisualization() {
  const total = applications.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Sankey */}
      <SankeyDiagram />

      {/* Conversion stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
        {[
          { label: "Submitted Applications", value: `${applications.filter((a) => a.status !== "wishlist").length}/${total}`, note: "Applied from wishlist", color: "#7C3AED" },
          { label: "Applied → Interview", value: `${applications.filter((a) => a.status === "interviewing" || a.status === "offer").length}/${applications.filter((a) => a.appliedDate !== "").length}`, note: "Interview conversion rate", color: "#D97706" },
          { label: "Interview → Offer", value: `${applications.filter((a) => a.status === "offer").length}/${applications.filter((a) => a.status === "interviewing" || a.status === "offer").length}`, note: "Offer conversion rate", color: "#059669" },
        ].map((stat) => (
          <div key={stat.label} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "10px", padding: "16px 18px" }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--muted-foreground)", marginBottom: "6px" }}>{stat.label}</p>
            <p style={{ fontFamily: "var(--font-mono-base)", fontSize: "1.25rem", fontWeight: 700, color: stat.color, marginBottom: "2px" }}>{stat.value}</p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{stat.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Pipeline({ onNavigate }: PipelineProps) {
  const [view, setView] = useState<"board" | "visualization">("board");

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "1.5rem", fontWeight: 700, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
            Pipeline
          </h1>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--muted-foreground)", marginTop: "2px" }}>
            {applications.length} total · {applications.filter((a) => a.status !== "rejected").length} active
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div style={{ display: "flex", background: "var(--muted)", borderRadius: "8px", padding: "3px", gap: "2px" }}>
            {([
              { id: "board", label: "Board", icon: "M2 2h4v4H2zM9 2h5v4H9zM2 9h4v5H2zM9 9h5v5H9z" },
              { id: "visualization", label: "Insights", icon: "M2 11l4-4 3 3 5-6" },
            ] as const).map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                style={{
                  padding: "5px 10px", borderRadius: "6px", border: "none",
                  background: view === v.id ? "var(--card)" : "transparent",
                  boxShadow: view === v.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  cursor: "pointer",
                  color: view === v.id ? "var(--primary)" : "var(--muted-foreground)",
                  display: "flex", alignItems: "center", gap: "5px",
                  fontFamily: "var(--font-body)", fontSize: "0.8rem",
                  fontWeight: view === v.id ? 600 : 400,
                  transition: "all 0.15s",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d={v.icon} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                {v.label}
              </button>
            ))}
          </div>
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

      {view === "board" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", minHeight: "calc(100vh - 220px)" }}>
          {STATUS_COLUMNS.map((col) => {
            const colApps = applications.filter((a) => a.status === col.id);
            return (
              <div key={col.id} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "8px", background: col.bg, border: `1px solid ${col.color}33` }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: col.color, display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.8rem", color: col.color, flex: 1 }}>{col.label}</span>
                  <span style={{ fontFamily: "var(--font-mono-base)", fontSize: "0.6875rem", color: col.color, background: col.color + "22", padding: "1px 6px", borderRadius: "100px" }}>
                    {colApps.length}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {colApps.map((app) => (
                    <KanbanCard key={app.id} app={app} colColor={col.color} onNavigate={onNavigate} />
                  ))}
                </div>
                <button
                  style={{ padding: "8px", borderRadius: "8px", border: `1.5px dashed ${col.color}44`, background: "transparent", fontFamily: "var(--font-body)", fontSize: "0.75rem", color: col.color, opacity: 0.7, cursor: "pointer", transition: "opacity 0.15s", marginTop: "4px" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.7")}
                  onClick={() => onNavigate("add")}
                >
                  + Add
                </button>
              </div>
            );
          })}
        </div>
      )}

      {view === "visualization" && <PipelineVisualization />}
    </div>
  );
}

function KanbanCard({ app, colColor, onNavigate }: { app: Application; colColor: string; onNavigate: (s: string, id?: string) => void }) {
  return (
    <div
      onClick={() => onNavigate("detail", app.id)}
      style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px", cursor: "pointer", transition: "box-shadow 0.15s, transform 0.15s", borderLeft: `3px solid ${colColor}` }}
      onMouseEnter={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; el.style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = "none"; el.style.transform = "translateY(0)"; }}
    >
      <div className="flex items-start gap-2.5 mb-2.5">
        <LogoPlaceholder initials={app.logoInitials} color={app.logoColor} size={30} />
        <div className="flex-1 min-w-0">
          <p style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.8125rem", color: "var(--foreground)", lineHeight: 1.3 }}>{app.company}</p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3, marginTop: "1px" }}>{app.position}</p>
        </div>
      </div>
      {app.deadline && (
        <div className="flex items-center gap-1.5 mt-2">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <circle cx="5.5" cy="5.5" r="4.5" stroke="var(--muted-foreground)" strokeWidth="1.2" />
            <path d="M5.5 3v2.5l1.5 1.5" stroke="var(--muted-foreground)" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span style={{ fontFamily: "var(--font-mono-base)", fontSize: "0.6625rem", color: "var(--muted-foreground)" }}>
            {new Date(app.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
          {app.salary && (
            <>
              <span style={{ color: "var(--border)", fontSize: "0.75rem" }}>·</span>
              <span style={{ fontFamily: "var(--font-mono-base)", fontSize: "0.6625rem", color: "var(--muted-foreground)" }}>{app.salary}</span>
            </>
          )}
        </div>
      )}
      {app.interviewStages.length > 0 && (
        <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "5px" }}>
          {app.interviewStages.map((stage) => (
            <div key={stage.id} style={{ width: "18px", height: "4px", borderRadius: "2px", background: stage.completed ? colColor : colColor + "33" }} title={stage.name} />
          ))}
          <span style={{ fontFamily: "var(--font-body)", fontSize: "0.6375rem", color: "var(--muted-foreground)", marginLeft: "2px" }}>
            {app.interviewStages.filter((s) => s.completed).length}/{app.interviewStages.length} stages
          </span>
        </div>
      )}
    </div>
  );
}
