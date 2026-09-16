import { useState } from "react";
import { applications, tasks, recentActivity, upcomingDeadlines, upcomingInterviews } from "../data/mockData";

interface DashboardProps {
  onNavigate: (screen: string, id?: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [taskList, setTaskList] = useState(tasks);

  const activeApps = applications.filter((a) => a.status !== "rejected").length;
  const interviewCount = applications.filter((a) => a.status === "interviewing").length;

  const toggleTask = (id: string) => {
    setTaskList((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const activityColor = (type: string) => {
    if (type === "offer") return "#16A34A";
    if (type === "rejected") return "#DC2626";
    if (type === "interview") return "#D97706";
    return "var(--primary)";
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--muted-foreground)", marginBottom: "4px" }}>
            Thursday, September 4, 2026
          </p>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "1.625rem", fontWeight: 700, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
            Good morning, Jordan
          </h1>
        </div>
        <button
          onClick={() => onNavigate("add")}
          style={{ background: "var(--primary)", color: "white", border: "none", borderRadius: "8px", padding: "9px 16px", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", transition: "opacity 0.15s" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.85")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add Application
        </button>
      </div>

      {/* Summary stats — flat, no icon boxes */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Active Applications", value: activeApps, sub: "2 added this week", accent: "var(--primary)" },
          { label: "Deadlines in 2 weeks", value: upcomingDeadlines.filter((d) => d.daysLeft <= 14).length, sub: "Meridian Health is next", accent: "#B45309" },
          { label: "Upcoming Interviews", value: interviewCount, sub: "Acme Corp onsite — Sep 8", accent: "#6D28D9" },
        ].map((card) => (
          <div
            key={card.label}
            style={{ background: "var(--card)", border: "1px solid var(--border)", borderLeft: `3px solid ${card.accent}`, borderRadius: "8px", padding: "20px 20px 18px" }}
          >
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--muted-foreground)", marginBottom: "8px" }}>
              {card.label}
            </p>
            <p style={{ fontFamily: "var(--font-heading)", fontSize: "2rem", fontWeight: 700, color: "var(--foreground)", letterSpacing: "-0.03em", lineHeight: 1, marginBottom: "6px" }}>
              {card.value}
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 1fr 312px" }}>

        {/* Deadlines */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", padding: "20px" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.9375rem", color: "var(--foreground)" }}>
              Upcoming Deadlines
            </h2>
            <button
              style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--primary)", background: "none", border: "none", cursor: "pointer" }}
              onClick={() => onNavigate("applications")}
            >
              View all →
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {upcomingDeadlines.map((item) => (
              <div
                key={item.id}
                style={{ display: "flex", alignItems: "center", padding: "10px 12px", borderRadius: "6px", background: "var(--muted)", cursor: "pointer", transition: "background 0.12s" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "var(--accent)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "var(--muted)")}
                onClick={() => onNavigate("detail", item.id)}
              >
                <div className="flex-1 min-w-0">
                  <p style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.8125rem", color: "var(--foreground)", marginBottom: "1px" }}>
                    {item.company}
                  </p>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.position}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span style={{ fontFamily: "var(--font-mono-base)", fontSize: "0.6875rem", color: "var(--muted-foreground)" }}>
                    {new Date(item.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono-base)", fontSize: "0.6875rem", fontWeight: 500,
                      padding: "2px 6px", borderRadius: "4px",
                      background: item.daysLeft <= 7 ? "#FEE2E2" : item.daysLeft <= 14 ? "#FEF3C7" : "var(--muted)",
                      color: item.daysLeft <= 7 ? "#B91C1C" : item.daysLeft <= 14 ? "#92400E" : "var(--muted-foreground)",
                    }}
                  >
                    {item.daysLeft}d
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Interviews + Activity */}
        <div className="flex flex-col gap-6">
          {/* Interviews */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", padding: "20px" }}>
            <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.9375rem", color: "var(--foreground)", marginBottom: "14px" }}>
              Upcoming Interviews
            </h2>
            {upcomingInterviews.length === 0 ? (
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--muted-foreground)" }}>
                No interviews scheduled.
              </p>
            ) : (
              upcomingInterviews.map((iv) => (
                <div
                  key={iv.id}
                  style={{ borderRadius: "6px", background: "var(--muted)", border: "1px solid var(--border)", borderLeft: "3px solid var(--primary)", padding: "14px 16px", cursor: "pointer" }}
                  onClick={() => onNavigate("detail", "1")}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.875rem", color: "var(--foreground)" }}>
                      {iv.company}
                    </p>
                    <span style={{ fontFamily: "var(--font-mono-base)", fontSize: "0.6875rem", fontWeight: 600, color: "var(--primary)" }}>
                      {new Date(iv.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--muted-foreground)", marginBottom: "6px" }}>
                    {iv.stage}
                  </p>
                  <p style={{ fontFamily: "var(--font-mono-base)", fontSize: "0.6875rem", color: "var(--muted-foreground)" }}>
                    {iv.time}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Recent Activity */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", padding: "20px", flex: 1 }}>
            <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.9375rem", color: "var(--foreground)", marginBottom: "16px" }}>
              Recent Activity
            </h2>
            <div className="flex flex-col">
              {recentActivity.map((item, i) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: "12px",
                    paddingBottom: i < recentActivity.length - 1 ? "14px" : 0,
                    marginBottom: i < recentActivity.length - 1 ? "14px" : 0,
                    borderBottom: i < recentActivity.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div
                    style={{
                      width: "3px", height: "36px", borderRadius: "2px",
                      background: activityColor(item.icon),
                      flexShrink: 0, marginTop: "2px",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--foreground)", marginBottom: "2px", lineHeight: 1.4 }}>
                      {item.text}
                    </p>
                    <p style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--muted-foreground)" }}>
                      {item.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tasks */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", padding: "20px" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.9375rem", color: "var(--foreground)" }}>
              Tasks & Follow-ups
            </h2>
            <span style={{ fontFamily: "var(--font-mono-base)", fontSize: "0.6875rem", color: "var(--muted-foreground)" }}>
              {taskList.filter((t) => !t.done).length} open
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {taskList.map((task) => (
              <label
                key={task.id}
                style={{
                  display: "flex", alignItems: "flex-start", gap: "10px",
                  padding: "9px 10px", borderRadius: "6px", cursor: "pointer",
                  transition: "background 0.12s",
                  background: task.done ? "transparent" : "var(--muted)",
                  opacity: task.done ? 0.5 : 1,
                }}
                onMouseEnter={(e) => { if (!task.done) (e.currentTarget as HTMLLabelElement).style.background = "var(--accent)"; }}
                onMouseLeave={(e) => { if (!task.done) (e.currentTarget as HTMLLabelElement).style.background = "var(--muted)"; }}
              >
                <div style={{ paddingTop: "1px", flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => toggleTask(task.id)}
                    style={{ accentColor: "var(--primary)", width: "14px", height: "14px", cursor: "pointer" }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--foreground)", textDecoration: task.done ? "line-through" : "none", lineHeight: 1.45 }}>
                    {task.text}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--muted-foreground)" }}>
                      {task.company}
                    </span>
                    <span style={{ color: "var(--border)", fontSize: "0.75rem" }}>·</span>
                    <span style={{ fontFamily: "var(--font-mono-base)", fontSize: "0.6375rem", color: "var(--muted-foreground)" }}>
                      Due {new Date(task.due).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
              </label>
            ))}
          </div>
          <button
            style={{
              marginTop: "12px", width: "100%", padding: "8px",
              borderRadius: "6px", border: "1.5px dashed var(--border)",
              background: "transparent", fontFamily: "var(--font-body)",
              fontSize: "0.8rem", color: "var(--muted-foreground)", cursor: "pointer", transition: "all 0.12s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--primary)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--primary)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--muted-foreground)"; }}
          >
            + Add task
          </button>
        </div>
      </div>
    </div>
  );
}
