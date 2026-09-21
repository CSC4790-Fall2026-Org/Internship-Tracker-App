import { useRef, useState } from "react";
import { uploadAndParseResume, type ResumeProfile, type UploadStage } from "../data/resume";

interface OnboardingProps {
  userId: string;
  userName: string;
  /** Marks onboarding finished and drops the user into the app. */
  onFinish: () => void;
}

export default function Onboarding({ userId, userName, onFinish }: OnboardingProps) {
  const [stage, setStage] = useState<UploadStage | null>(null);
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const firstName = userName.split(" ")[0];

  const handleFile = async (file: File) => {
    setError(null);
    try {
      setProfile(await uploadAndParseResume(userId, file, setStage));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStage(null);
    }
  };

  const busy = stage !== null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 24px" }}>
      <div style={{ width: "100%", maxWidth: "560px" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "28px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#1E3A8A", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 15 15" fill="none">
              <circle cx="2.5" cy="7.5" r="2" fill="white" />
              <circle cx="7.5" cy="7.5" r="2" fill="white" fillOpacity="0.7" />
              <circle cx="12.5" cy="7.5" r="2" fill="white" fillOpacity="0.4" />
              <path d="M4.5 7.5h1.5M9.5 7.5h1.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1.0625rem", color: "var(--foreground)", letterSpacing: "-0.02em" }}>
            Pipeline
          </span>
        </div>

        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "14px", padding: "32px" }}>
          {profile ? (
            <ProfileConfirmation profile={profile} onFinish={onFinish} onRetry={() => { setProfile(null); setError(null); }} />
          ) : (
            <>
              <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "1.375rem", fontWeight: 700, color: "var(--foreground)", letterSpacing: "-0.02em", marginBottom: "6px" }}>
                Welcome, {firstName}
              </h1>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--muted-foreground)", lineHeight: 1.6, marginBottom: "24px" }}>
                Add your resume and we'll fill in your skills, coursework and experience automatically. We use it to tailor internship recommendations — and you won't have to retype any of it.
              </p>

              {error && (
                <div role="alert" style={{ background: "#FEE2E2", color: "#B91C1C", border: "1px solid #FCA5A5", borderRadius: "8px", padding: "10px 14px", fontFamily: "var(--font-body)", fontSize: "0.8125rem", marginBottom: "16px" }}>
                  {error}
                </div>
              )}

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!busy && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
                }}
                style={{ border: "1.5px dashed var(--border)", borderRadius: "12px", padding: "28px", textAlign: "center", background: "var(--muted)" }}
              >
                <input
                  ref={fileInput}
                  type="file"
                  accept="application/pdf"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) handleFile(file);
                  }}
                />
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", fontWeight: 500, color: "var(--foreground)", marginBottom: "4px" }}>
                  {busy ? (stage === "uploading" ? "Uploading…" : "Reading your resume…") : "Drop your resume here"}
                </p>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--muted-foreground)", marginBottom: "16px" }}>
                  {busy ? "This usually takes a few seconds." : "PDF, up to 5 MB"}
                </p>
                <button
                  onClick={() => fileInput.current?.click()}
                  disabled={busy}
                  style={{
                    background: "var(--primary)", color: "white", border: "none", borderRadius: "8px",
                    padding: "10px 20px", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.875rem",
                    cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
                  }}
                >
                  Choose file
                </button>
              </div>

              <div style={{ textAlign: "center", marginTop: "20px" }}>
                <button
                  onClick={onFinish}
                  disabled={busy}
                  style={{ background: "none", border: "none", fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--muted-foreground)", cursor: busy ? "not-allowed" : "pointer", textDecoration: "underline" }}
                >
                  Skip for now
                </button>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--muted-foreground)", marginTop: "6px" }}>
                  You can add it later from the Profile tab.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileConfirmation({ profile, onFinish, onRetry }: { profile: ResumeProfile; onFinish: () => void; onRetry: () => void }) {
  const rows = [
    { label: "Name", value: profile.full_name },
    { label: "School", value: profile.school },
    { label: "Major", value: profile.major },
    { label: "Graduation", value: profile.graduation },
    { label: "Skills", value: profile.skills.slice(0, 6).join(", ") + (profile.skills.length > 6 ? ` +${profile.skills.length - 6} more` : "") },
    { label: "Experience", value: `${profile.experience.length} ${profile.experience.length === 1 ? "entry" : "entries"}` },
  ].filter((row) => row.value);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
        <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6l2.5 2.5L9.5 3.5" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "1.25rem", fontWeight: 700, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
          Here's what we found
        </h1>
      </div>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--muted-foreground)", marginBottom: "20px" }}>
        You can correct any of this later in the Profile tab.
      </p>

      <div style={{ background: "var(--muted)", borderRadius: "10px", padding: "16px 18px", marginBottom: "22px" }}>
        {rows.map((row, i) => (
          <div
            key={row.label}
            style={{
              display: "flex", gap: "14px", alignItems: "baseline",
              paddingBottom: i < rows.length - 1 ? "10px" : 0,
              marginBottom: i < rows.length - 1 ? "10px" : 0,
              borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none",
            }}
          >
            <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--muted-foreground)", width: "88px", flexShrink: 0 }}>
              {row.label}
            </span>
            <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--foreground)", lineHeight: 1.5 }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={onFinish}
        style={{
          width: "100%", background: "var(--primary)", color: "white", border: "none", borderRadius: "8px",
          padding: "11px", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.9375rem", cursor: "pointer",
        }}
      >
        Continue to Pipeline
      </button>
      <div style={{ textAlign: "center", marginTop: "12px" }}>
        <button
          onClick={onRetry}
          style={{ background: "none", border: "none", fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--muted-foreground)", cursor: "pointer", textDecoration: "underline" }}
        >
          Upload a different file
        </button>
      </div>
    </>
  );
}
