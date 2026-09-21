import { useState } from "react";
import { useData } from "../data/DataContext";
import { daysUntil, toDate, todayISO } from "../data/dates";

interface DashboardProps {
  onNavigate: (screen: string, id?: string) => void;
  userName: string;
}

export default function Dashboard({ onNavigate, userName }: DashboardProps) {
  const { applications, tasks: taskList, recentActivity, addTask, setTaskDone } = useData();
  const [newTask, setNewTask] = useState<{ text: string; due: string; applicationId: string } | null>(null);
  const [savingTask, setSavingTask] = useState(false);

  const today = todayISO();
  const activeApps = applications.filter((a) => a.status !== "rejected").length;
  const upcomingDeadlines = applications
    .filter((a) => a.deadline && a.deadline >= today && a.status !== "rejected" && a.status !== "offer")
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .map((a) => ({ id: a.id, company: a.company, position: a.position, deadline: a.deadline, daysLeft: daysUntil(a.deadline) }));
  const upcomingInterviews = applications
    .flatMap((a) => a.interviewStages.filter((s) => !s.completed && s.date >= today).map((s) => ({ id: s.id, appId: a.id, company: a.company, position: a.position, stage: s.name, date: s.date })))
    .sort((a, b) => a.date.localeCompare(b.date));
  const deadlinesSoon = upcomingDeadlines.filter((d) => d.daysLeft <= 14);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const addedThisWeek = applications.filter((a) => a.appliedDate && a.appliedDate >= weekAgo).length;

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const firstName = userName.split(" ")[0];

  const saveTask = async () => {
    if (!newTask?.text.trim()) return;
    setSavingTask(true);
    try {
      await addTask({ text: newTask.text, due: newTask.due, applicationId: newTask.applicationId || null });
      setNewTask(null);
    } catch (e) {
      alert(`Couldn't add task: ${(e as Error).message}`);
    } finally {
      setSavingTask(false);
    }
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
            {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "1.625rem", fontWeight: 700, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
            {greeting}, {firstName}
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
          { label: "Active Applications", value: activeApps, sub: `${addedThisWeek} applied this week`, accent: "var(--primary)" },
          { label: "Deadlines in 2 weeks", value: deadlinesSoon.length, sub: deadlinesSoon.length ? `${deadlinesSoon[0].company} is next` : "Nothing due soon", accent: "#B45309" },
          { label: "Upcoming Interviews", value: upcomingInterviews.length, sub: upcomingInterviews.length ? `${upcomingInterviews[0].company} — ${toDate(upcomingInterviews[0].date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "None scheduled", accent: "#6D28D9" },
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
            {upcomingDeadlines.length === 0 && (
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--muted-foreground)" }}>
                No upcoming deadlines.
              </p>
            )}
            {upcomingDeadlines.slice(0, 5).map((item) => (
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
                    {toDate(item.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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
              upcomingInterviews.slice(0, 3).map((iv) => (
                <div
                  key={iv.id}
                  style={{ borderRadius: "6px", background: "var(--muted)", border: "1px solid var(--border)", borderLeft: "3px solid var(--primary)", padding: "14px 16px", cursor: "pointer", marginBottom: "8px" }}
                  onClick={() => onNavigate("detail", iv.appId)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.875rem", color: "var(--foreground)" }}>
                      {iv.company}
                    </p>
                    <span style={{ fontFamily: "var(--font-mono-base)", fontSize: "0.6875rem", fontWeight: 600, color: "var(--primary)" }}>
                      {toDate(iv.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--muted-foreground)", marginBottom: "6px" }}>
                    {iv.stage}
                  </p>
                  <p style={{ fontFamily: "var(--font-mono-base)", fontSize: "0.6875rem", color: "var(--muted-foreground)" }}>
                    {iv.position}
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
              {recentActivity.length === 0 && (
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--muted-foreground)" }}>
                  No activity yet. Add your first application to get started.
                </p>
              )}
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
                    onChange={() => setTaskDone(task.id, !task.done).catch((e) => alert(`Couldn't update task: ${e.message}`))}
                    style={{ accentColor: "var(--primary)", width: "14px", height: "14px", cursor: "pointer" }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--foreground)", textDecoration: task.done ? "line-through" : "none", lineHeight: 1.45 }}>
                    {task.text}
                  </p>
                  {(task.company || task.due) && (
                    <div className="flex items-center gap-2 mt-1">
                      {task.company && (
                        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--muted-foreground)" }}>
                          {task.company}
                        </span>
                      )}
                      {task.company && task.due && <span style={{ color: "var(--border)", fontSize: "0.75rem" }}>·</span>}
                      {task.due && (
                        <span style={{ fontFamily: "var(--font-mono-base)", fontSize: "0.6375rem", color: "var(--muted-foreground)" }}>
                          Due {toDate(task.due).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
          {taskList.length === 0 && !newTask && (
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--muted-foreground)" }}>
              No tasks yet.
            </p>
          )}
          {newTask ? (
            <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <input
                autoFocus
                placeholder="What needs doing?"
                value={newTask.text}
                onChange={(e) => setNewTask({ ...newTask, text: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") saveTask(); if (e.key === "Escape") setNewTask(null); }}
                style={taskInputStyle}
              />
              <div style={{ display: "flex", gap: "6px" }}>
                <select value={newTask.applicationId} onChange={(e) => setNewTask({ ...newTask, applicationId: e.target.value })} style={{ ...taskInputStyle, flex: 1, minWidth: 0 }}>
                  <option value="">No application</option>
                  {applications.map((a) => (
                    <option key={a.id} value={a.id}>{a.company}</option>
                  ))}
                </select>
                <input type="date" value={newTask.due} onChange={(e) => setNewTask({ ...newTask, due: e.target.value })} style={{ ...taskInputStyle, width: "auto" }} />
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={saveTask}
                  disabled={savingTask || !newTask.text.trim()}
                  style={{ flex: 1, padding: "7px", borderRadius: "6px", border: "none", background: "var(--primary)", color: "white", fontFamily: "var(--font-body)", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", opacity: savingTask || !newTask.text.trim() ? 0.6 : 1 }}
                >
                  {savingTask ? "Saving…" : "Add task"}
                </button>
                <button
                  onClick={() => setNewTask(null)}
                  style={{ padding: "7px 12px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--muted)", color: "var(--foreground)", fontFamily: "var(--font-body)", fontSize: "0.8rem", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
          <button
            onClick={() => setNewTask({ text: "", due: "", applicationId: "" })}
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
          )}
        </div>
      </div>
    </div>
  );
}

const taskInputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 10px", boxSizing: "border-box",
  fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--foreground)",
  background: "var(--muted)", border: "1px solid var(--border)", borderRadius: "6px", outline: "none",
};
