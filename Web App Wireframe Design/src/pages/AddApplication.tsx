import { useState } from "react";
import { AppStatus } from "../data/mockData";

interface AddApplicationProps {
  onNavigate: (screen: string, id?: string) => void;
}

export default function AddApplication({ onNavigate }: AddApplicationProps) {
  const [form, setForm] = useState({
    company: "",
    position: "",
    jobUrl: "",
    deadline: "",
    status: "wishlist" as AppStatus,
    location: "",
    salary: "",
    notes: "",
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const fieldStyle = {
    width: "100%",
    fontFamily: "var(--font-body)",
    fontSize: "0.875rem",
    color: "var(--foreground)",
    background: "var(--muted)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "9px 12px",
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
    boxSizing: "border-box" as const,
  };

  const labelStyle = {
    fontFamily: "var(--font-body)",
    fontSize: "0.8rem",
    fontWeight: 500,
    color: "var(--foreground)",
    display: "block",
    marginBottom: "5px",
  };

  const STATUS_OPTIONS = [
    { id: "wishlist", label: "Wishlist" },
    { id: "applied", label: "Applied" },
    { id: "interviewing", label: "Interviewing" },
    { id: "offer", label: "Offer" },
    { id: "rejected", label: "Closed" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onNavigate("applications"); }}
    >
      <div
        style={{
          background: "var(--card)",
          borderRadius: "16px",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          width: "100%",
          maxWidth: "560px",
          maxHeight: "90vh",
          overflow: "auto",
        }}
      >
        {/* Modal header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            background: "var(--card)",
            borderRadius: "16px 16px 0 0",
            zIndex: 1,
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "1.125rem",
                fontWeight: 700,
                color: "var(--foreground)",
                letterSpacing: "-0.01em",
              }}
            >
              New Application
            </h2>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--muted-foreground)", marginTop: "2px" }}>
              Track a new job or internship opportunity
            </p>
          </div>
          <button
            onClick={() => onNavigate("applications")}
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
              color: "var(--muted-foreground)",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Form body */}
        <div style={{ padding: "24px" }}>
          {/* Company + Position */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label style={labelStyle}>
                Company <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Acme Corp"
                value={form.company}
                onChange={(e) => handleChange("company", e.target.value)}
                style={fieldStyle}
                onFocus={(e) => {
                  (e.currentTarget as HTMLInputElement).style.borderColor = "var(--ring)";
                  (e.currentTarget as HTMLInputElement).style.boxShadow = "0 0 0 3px var(--accent)";
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLInputElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLInputElement).style.boxShadow = "none";
                }}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Position <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Software Engineer Intern"
                value={form.position}
                onChange={(e) => handleChange("position", e.target.value)}
                style={fieldStyle}
                onFocus={(e) => {
                  (e.currentTarget as HTMLInputElement).style.borderColor = "var(--ring)";
                  (e.currentTarget as HTMLInputElement).style.boxShadow = "0 0 0 3px var(--accent)";
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLInputElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLInputElement).style.boxShadow = "none";
                }}
              />
            </div>
          </div>

          {/* Job URL */}
          <div className="mb-4">
            <label style={labelStyle}>Job Posting URL</label>
            <input
              type="url"
              placeholder="https://company.com/jobs/..."
              value={form.jobUrl}
              onChange={(e) => handleChange("jobUrl", e.target.value)}
              style={fieldStyle}
              onFocus={(e) => {
                (e.currentTarget as HTMLInputElement).style.borderColor = "var(--ring)";
                (e.currentTarget as HTMLInputElement).style.boxShadow = "0 0 0 3px var(--accent)";
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLInputElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLInputElement).style.boxShadow = "none";
              }}
            />
          </div>

          {/* Deadline + Status */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label style={labelStyle}>Application Deadline</label>
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => handleChange("deadline", e.target.value)}
                style={fieldStyle}
                onFocus={(e) => {
                  (e.currentTarget as HTMLInputElement).style.borderColor = "var(--ring)";
                  (e.currentTarget as HTMLInputElement).style.boxShadow = "0 0 0 3px var(--accent)";
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLInputElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLInputElement).style.boxShadow = "none";
                }}
              />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select
                value={form.status}
                onChange={(e) => handleChange("status", e.target.value)}
                style={fieldStyle}
                onFocus={(e) => {
                  (e.currentTarget as HTMLSelectElement).style.borderColor = "var(--ring)";
                  (e.currentTarget as HTMLSelectElement).style.boxShadow = "0 0 0 3px var(--accent)";
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLSelectElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLSelectElement).style.boxShadow = "none";
                }}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Location + Salary */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label style={labelStyle}>Location</label>
              <input
                type="text"
                placeholder="e.g. San Francisco, CA (Hybrid)"
                value={form.location}
                onChange={(e) => handleChange("location", e.target.value)}
                style={fieldStyle}
                onFocus={(e) => {
                  (e.currentTarget as HTMLInputElement).style.borderColor = "var(--ring)";
                  (e.currentTarget as HTMLInputElement).style.boxShadow = "0 0 0 3px var(--accent)";
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLInputElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLInputElement).style.boxShadow = "none";
                }}
              />
            </div>
            <div>
              <label style={labelStyle}>Compensation</label>
              <input
                type="text"
                placeholder="e.g. $42/hr or $85,000/yr"
                value={form.salary}
                onChange={(e) => handleChange("salary", e.target.value)}
                style={fieldStyle}
                onFocus={(e) => {
                  (e.currentTarget as HTMLInputElement).style.borderColor = "var(--ring)";
                  (e.currentTarget as HTMLInputElement).style.boxShadow = "0 0 0 3px var(--accent)";
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLInputElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLInputElement).style.boxShadow = "none";
                }}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label style={labelStyle}>Notes</label>
            <textarea
              placeholder="Any relevant context — referrals, recruiter info, application requirements, etc."
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              rows={4}
              style={{
                ...fieldStyle,
                resize: "vertical",
                lineHeight: 1.6,
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLTextAreaElement).style.borderColor = "var(--ring)";
                (e.currentTarget as HTMLTextAreaElement).style.boxShadow = "0 0 0 3px var(--accent)";
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLTextAreaElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLTextAreaElement).style.boxShadow = "none";
              }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              style={{
                flex: 1,
                background: "var(--primary)",
                color: "white",
                border: "none",
                borderRadius: "9px",
                padding: "10px",
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: "pointer",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.88")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
              onClick={() => onNavigate("applications")}
            >
              Save Application
            </button>
            <button
              onClick={() => onNavigate("applications")}
              style={{
                padding: "10px 18px",
                background: "var(--muted)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
                borderRadius: "9px",
                fontFamily: "var(--font-body)",
                fontWeight: 500,
                fontSize: "0.875rem",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--border)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--muted)")}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
