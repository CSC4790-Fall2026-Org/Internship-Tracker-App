import { useState } from "react";
import { applications, AppStatus } from "../data/mockData";

const STATUS_OPTIONS: { id: AppStatus; label: string; color: string; bg: string }[] = [
  { id: "wishlist", label: "Wishlist", color: "#64748B", bg: "#F1F5F9" },
  { id: "applied", label: "Applied", color: "#2563EB", bg: "#DBEAFE" },
  { id: "interviewing", label: "Interviewing", color: "#D97706", bg: "#FEF3C7" },
  { id: "offer", label: "Offer", color: "#059669", bg: "#DCFCE7" },
  { id: "rejected", label: "Closed", color: "#DC2626", bg: "#FEE2E2" },
];

interface ApplicationDetailProps {
  appId: string;
  onNavigate: (screen: string, id?: string) => void;
}

export default function ApplicationDetail({ appId, onNavigate }: ApplicationDetailProps) {
  const app = applications.find((a) => a.id === appId) || applications[0];
  const [status, setStatus] = useState<AppStatus>(app.status);
  const [activeTab, setActiveTab] = useState<"overview" | "interviews" | "contacts">("overview");

  const statusOpt = STATUS_OPTIONS.find((s) => s.id === status)!;

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 mb-6">
        <button
          onClick={() => onNavigate("applications")}
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            color: "var(--muted-foreground)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          Applications
        </button>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M4.5 3l3 3-3 3" stroke="var(--muted-foreground)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--foreground)" }}>
          {app.company} — {app.position}
        </span>
      </nav>

      {/* Header card */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "24px",
          marginBottom: "20px",
        }}
      >
        <div className="flex items-start gap-4">
          {/* Logo */}
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "12px",
              background: app.logoColor + "22",
              border: `2px solid ${app.logoColor}44`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "1.0625rem",
              color: app.logoColor,
              flexShrink: 0,
            }}
          >
            {app.logoInitials}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "1.375rem",
                    fontWeight: 700,
                    color: "var(--foreground)",
                    letterSpacing: "-0.02em",
                    marginBottom: "3px",
                  }}
                >
                  {app.position}
                </h1>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", color: "var(--muted-foreground)" }}>
                  {app.company} · {app.location}
                </p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                {/* Status dropdown */}
                <div style={{ position: "relative" }}>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AppStatus)}
                    style={{
                      fontFamily: "var(--font-body)",
                      fontWeight: 600,
                      fontSize: "0.8125rem",
                      color: statusOpt.color,
                      background: statusOpt.bg,
                      border: `1px solid ${statusOpt.color}55`,
                      borderRadius: "8px",
                      padding: "7px 12px",
                      cursor: "pointer",
                      outline: "none",
                      appearance: "none",
                      paddingRight: "28px",
                    }}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    style={{ position: "absolute", right: "9px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: statusOpt.color }}
                  >
                    <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>

                <button
                  style={{
                    background: "var(--muted)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "7px 12px",
                    fontFamily: "var(--font-body)",
                    fontSize: "0.8125rem",
                    color: "var(--muted-foreground)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M9 1L11 3l-6 6H3V7L9 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                  </svg>
                  Edit
                </button>
              </div>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-4 mt-4">
              {[
                { icon: "M3 5h6M3 8h4", label: "Applied", value: app.appliedDate ? new Date(app.appliedDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Not yet applied" },
                { icon: "M6 2a4 4 0 1 0 0 8", label: "Deadline", value: app.deadline ? new Date(app.deadline).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "No deadline" },
                { icon: "M2 6h8M7 3l3 3-3 3", label: "Salary", value: app.salary || "Not listed" },
              ].map((m) => (
                <div key={m.label} className="flex items-center gap-1.5">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: "var(--muted-foreground)", flexShrink: 0 }}>
                    <path d={m.icon} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--muted-foreground)" }}>{m.label}:</span>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", fontWeight: 500, color: "var(--foreground)" }}>{m.value}</span>
                </div>
              ))}
              {app.jobUrl && (
                <a
                  href={app.jobUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontFamily: "var(--font-body)",
                    fontSize: "0.8rem",
                    color: "var(--primary)",
                    textDecoration: "none",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M5 3H3a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    <path d="M8 2h2v2M7.5 4.5L10 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  View Posting
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div
        style={{
          display: "flex",
          gap: "2px",
          borderBottom: "1px solid var(--border)",
          marginBottom: "20px",
        }}
      >
        {(["overview", "interviews", "contacts"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.8125rem",
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? "var(--primary)" : "var(--muted-foreground)",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab ? "2px solid var(--primary)" : "2px solid transparent",
              padding: "8px 14px",
              cursor: "pointer",
              marginBottom: "-1px",
              textTransform: "capitalize",
              transition: "color 0.15s",
            }}
          >
            {tab === "interviews" ? `Interviews (${app.interviewStages.length})` : tab === "contacts" ? `Contacts (${app.contacts.length})` : "Overview"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="grid gap-5" style={{ gridTemplateColumns: activeTab === "overview" ? "1fr 340px" : "1fr" }}>
        {activeTab === "overview" && (
          <>
            <div className="flex flex-col gap-5">
              {/* Notes */}
              <div
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "20px",
                }}
              >
                <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.875rem", color: "var(--foreground)", marginBottom: "12px" }}>
                  Notes
                </h3>
                <textarea
                  defaultValue={app.notes}
                  style={{
                    width: "100%",
                    minHeight: "120px",
                    fontFamily: "var(--font-body)",
                    fontSize: "0.875rem",
                    color: "var(--foreground)",
                    background: "var(--muted)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    resize: "vertical",
                    outline: "none",
                    lineHeight: 1.6,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Interview stages preview */}
              {app.interviewStages.length > 0 && (
                <div
                  style={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    padding: "20px",
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.875rem", color: "var(--foreground)" }}>
                      Interview Progress
                    </h3>
                    <button
                      onClick={() => setActiveTab("interviews")}
                      style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--primary)", background: "none", border: "none", cursor: "pointer" }}
                    >
                      View details →
                    </button>
                  </div>

                  {/* Timeline */}
                  <div style={{ position: "relative" }}>
                    <div
                      style={{
                        position: "absolute",
                        left: "11px",
                        top: "12px",
                        bottom: "12px",
                        width: "1px",
                        background: "var(--border)",
                      }}
                    />
                    <div className="flex flex-col gap-4">
                      {app.interviewStages.map((stage) => (
                        <div key={stage.id} className="flex items-start gap-3" style={{ paddingLeft: "0" }}>
                          <div
                            style={{
                              width: "22px",
                              height: "22px",
                              borderRadius: "50%",
                              background: stage.completed ? "var(--primary)" : "var(--card)",
                              border: stage.completed ? "none" : "2px solid var(--border)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              zIndex: 1,
                              position: "relative",
                            }}
                          >
                            {stage.completed && (
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M2.5 5l2 2 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 pb-1">
                            <div className="flex items-center justify-between">
                              <p style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.8375rem", color: "var(--foreground)" }}>
                                {stage.name}
                              </p>
                              <span style={{ fontFamily: "var(--font-mono-base)", fontSize: "0.6875rem", color: "var(--muted-foreground)" }}>
                                {new Date(stage.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            </div>
                            {stage.notes && (
                              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--muted-foreground)", marginTop: "2px", lineHeight: 1.5 }}>
                                {stage.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right sidebar */}
            <div className="flex flex-col gap-5">
              {/* Key dates */}
              <div
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "18px",
                }}
              >
                <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.875rem", color: "var(--foreground)", marginBottom: "14px" }}>
                  Key Dates
                </h3>
                <div className="flex flex-col gap-3">
                  {[
                    { label: "Application Deadline", date: app.deadline, urgent: true },
                    { label: "Applied On", date: app.appliedDate, urgent: false },
                    { label: "Next Stage", date: app.interviewStages.find((s) => !s.completed)?.date || "", urgent: false },
                  ]
                    .filter((d) => d.date)
                    .map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--muted-foreground)" }}>{item.label}</span>
                        <span
                          style={{
                            fontFamily: "var(--font-mono-base)",
                            fontSize: "0.8rem",
                            fontWeight: 500,
                            color: item.urgent ? "var(--accent-foreground)" : "var(--foreground)",
                            background: item.urgent ? "var(--accent)" : "var(--muted)",
                            padding: "2px 8px",
                            borderRadius: "5px",
                          }}
                        >
                          {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Quick contacts */}
              {app.contacts.length > 0 && (
                <div
                  style={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    padding: "18px",
                  }}
                >
                  <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.875rem", color: "var(--foreground)", marginBottom: "12px" }}>
                    Contacts
                  </h3>
                  <div className="flex flex-col gap-3">
                    {app.contacts.map((contact) => (
                      <div key={contact.id} className="flex items-center gap-2.5">
                        <div
                          style={{
                            width: "30px",
                            height: "30px",
                            borderRadius: "50%",
                            background: "var(--accent)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontFamily: "var(--font-heading)",
                            fontWeight: 700,
                            fontSize: "0.6875rem",
                            color: "var(--accent-foreground)",
                            flexShrink: 0,
                          }}
                        >
                          {contact.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p style={{ fontFamily: "var(--font-body)", fontWeight: 500, fontSize: "0.8rem", color: "var(--foreground)" }}>
                            {contact.name}
                          </p>
                          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                            {contact.role}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "interviews" && (
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "24px",
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.9375rem", color: "var(--foreground)" }}>
                Interview Stages
              </h3>
              <button
                style={{
                  background: "var(--muted)",
                  border: "1px solid var(--border)",
                  borderRadius: "7px",
                  padding: "6px 12px",
                  fontFamily: "var(--font-body)",
                  fontSize: "0.8rem",
                  color: "var(--foreground)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Add Stage
              </button>
            </div>

            {app.interviewStages.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "48px 0",
                  color: "var(--muted-foreground)",
                }}
              >
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ margin: "0 auto 12px", display: "block", opacity: 0.4 }}>
                  <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M20 13v8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem" }}>No interview stages recorded yet</p>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: "15px",
                    top: "20px",
                    bottom: "20px",
                    width: "2px",
                    background: "var(--border)",
                  }}
                />
                <div className="flex flex-col gap-6">
                  {app.interviewStages.map((stage, i) => (
                    <div key={stage.id} className="flex gap-4" style={{ paddingLeft: "0" }}>
                      <div
                        style={{
                          width: "30px",
                          height: "30px",
                          borderRadius: "50%",
                          background: stage.completed ? "var(--primary)" : "var(--card)",
                          border: stage.completed ? "none" : "2px solid var(--border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          zIndex: 1,
                          position: "relative",
                        }}
                      >
                        {stage.completed ? (
                          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                            <path d="M3 6.5l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <span style={{ fontFamily: "var(--font-mono-base)", fontSize: "0.6875rem", color: "var(--muted-foreground)", fontWeight: 500 }}>
                            {i + 1}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          background: "var(--muted)",
                          borderRadius: "10px",
                          padding: "14px 16px",
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.875rem", color: "var(--foreground)" }}>
                            {stage.name}
                          </p>
                          <span style={{ fontFamily: "var(--font-mono-base)", fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                            {new Date(stage.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                        {stage.notes && (
                          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8375rem", color: "var(--muted-foreground)", lineHeight: 1.55 }}>
                            {stage.notes}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontFamily: "var(--font-body)",
                              fontSize: "0.75rem",
                              fontWeight: 500,
                              padding: "3px 8px",
                              borderRadius: "100px",
                              background: stage.completed ? "#DCFCE7" : "#FEF3C7",
                              color: stage.completed ? "#16A34A" : "#D97706",
                            }}
                          >
                            {stage.completed ? "✓ Completed" : "⏳ Upcoming"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "contacts" && (
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "24px",
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.9375rem", color: "var(--foreground)" }}>
                Related Contacts
              </h3>
              <button
                style={{
                  background: "var(--muted)",
                  border: "1px solid var(--border)",
                  borderRadius: "7px",
                  padding: "6px 12px",
                  fontFamily: "var(--font-body)",
                  fontSize: "0.8rem",
                  color: "var(--foreground)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Link Contact
              </button>
            </div>

            {app.contacts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "var(--muted-foreground)" }}>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem" }}>No contacts linked to this application yet</p>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "12px",
                }}
              >
                {app.contacts.map((contact) => (
                  <div
                    key={contact.id}
                    style={{
                      background: "var(--muted)",
                      borderRadius: "10px",
                      padding: "16px",
                      display: "flex",
                      gap: "12px",
                      alignItems: "flex-start",
                    }}
                  >
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        background: "var(--accent)",
                        border: "2px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "var(--font-heading)",
                        fontWeight: 700,
                        fontSize: "0.875rem",
                        color: "var(--accent-foreground)",
                        flexShrink: 0,
                      }}
                    >
                      {contact.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <p style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.875rem", color: "var(--foreground)", marginBottom: "2px" }}>
                        {contact.name}
                      </p>
                      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--muted-foreground)", marginBottom: "6px" }}>
                        {contact.role}
                      </p>
                      <a
                        href={`mailto:${contact.email}`}
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "0.75rem",
                          color: "var(--primary)",
                          textDecoration: "none",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                          <rect x="1" y="2.5" width="9" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
                          <path d="M1 3.5l4.5 3 4.5-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        </svg>
                        {contact.email}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
