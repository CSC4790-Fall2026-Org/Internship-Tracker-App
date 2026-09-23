import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Json } from "../lib/database.types";
import { fetchResumeProfile, uploadAndParseResume, type ExperienceItem, type ResumeProfile, type UploadStage } from "../data/resume";

type Stage = "idle" | UploadStage;

export default function AiCoach({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editingExperience, setEditingExperience] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchResumeProfile()
      .then(setProfile)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleFile = async (file: File) => {
    setError(null);
    setSaved(false);
    try {
      setProfile(await uploadAndParseResume(userId, file, setStage));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStage("idle");
    }
  };

  const update = <K extends keyof ResumeProfile>(field: K, value: ResumeProfile[K]) => {
    setProfile((p) => (p ? { ...p, [field]: value } : p));
    setSaved(false);
  };

  const updateExperience = (index: number, field: keyof ExperienceItem, value: string) =>
    update(
      "experience",
      profile!.experience.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );

  const removeExperience = (index: number) =>
    update("experience", profile!.experience.filter((_, i) => i !== index));

  const addExperience = () => {
    update("experience", [...profile!.experience, { title: "", organization: "", dates: "", highlight: "" }]);
    setEditingExperience(true);
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSavingProfile(true);
    setError(null);
    const { error } = await supabase
      .from("resume_profiles")
      .update({
        full_name: profile.full_name,
        email: profile.email,
        school: profile.school,
        major: profile.major,
        graduation: profile.graduation,
        summary: profile.summary,
        skills: profile.skills,
        interests: profile.interests,
        preferred_locations: profile.preferred_locations,
        // jsonb column: the row type is Json, our app type is stricter.
        experience: profile.experience as unknown as Json,
      })
      .eq("id", profile.id);
    setSavingProfile(false);
    if (error) setError(error.message);
    else setSaved(true);
  };

  const busy = stage !== "idle";

  return (
    <div className="max-w-[1000px] mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "1.5rem", fontWeight: 700, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
          Your Profile
        </h1>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--muted-foreground)", marginTop: "2px" }}>
          Upload your resume and we'll pull out the details we need to recommend internships. Check the result and fix anything we got wrong.
        </p>
      </div>

      {error && (
        <div role="alert" style={{ background: "#FEE2E2", color: "#B91C1C", border: "1px solid #FCA5A5", borderRadius: "8px", padding: "10px 14px", fontFamily: "var(--font-body)", fontSize: "0.8125rem", marginBottom: "16px" }}>
          {error}
        </div>
      )}

      {/* Upload */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!busy && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
        }}
        style={{
          background: "var(--card)", border: "1.5px dashed var(--border)", borderRadius: "12px",
          padding: "28px", marginBottom: "20px", textAlign: "center",
        }}
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
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--foreground)", marginBottom: "4px", fontWeight: 500 }}>
          {busy ? (stage === "uploading" ? "Uploading…" : "Reading your resume…") : "Drop your resume here, or choose a file"}
        </p>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--muted-foreground)", marginBottom: "14px" }}>
          {busy ? "This usually takes a few seconds." : "PDF, up to 5 MB."}
        </p>
        <button
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          style={{
            background: "var(--primary)", color: "white", border: "none", borderRadius: "8px",
            padding: "9px 18px", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.8125rem",
            cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
          }}
        >
          {profile ? "Replace resume" : "Choose file"}
        </button>
        {profile?.file_name && !busy && (
          <p style={{ fontFamily: "var(--font-mono-base)", fontSize: "0.6875rem", color: "var(--muted-foreground)", marginTop: "12px" }}>
            {profile.file_name}
            {profile.parsed_at && ` · read ${new Date(profile.parsed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
          </p>
        )}
      </div>

      {loading ? (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--muted-foreground)" }}>Loading…</p>
      ) : !profile ? (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--muted-foreground)", textAlign: "center" }}>
          No profile yet. Upload a resume to get started.
        </p>
      ) : (
        <>
          <Card title="Basics">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full name" value={profile.full_name} onChange={(v) => update("full_name", v)} />
              <Field label="Email" value={profile.email} onChange={(v) => update("email", v)} />
              <Field label="School" value={profile.school} onChange={(v) => update("school", v)} />
              <Field label="Major" value={profile.major} onChange={(v) => update("major", v)} />
              <Field label="Graduation" value={profile.graduation} onChange={(v) => update("graduation", v)} />
            </div>
          </Card>

          <Card title="Summary">
            <textarea
              value={profile.summary}
              onChange={(e) => update("summary", e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
            />
          </Card>

          <Card title="Skills">
            <TagEditor tags={profile.skills} onChange={(v) => update("skills", v)} placeholder="Add a skill" />
          </Card>

          <Card title="Interests">
            <TagEditor tags={profile.interests} onChange={(v) => update("interests", v)} placeholder="Add an interest" />
          </Card>

          <Card title="Preferred locations">
            <TagEditor tags={profile.preferred_locations} onChange={(v) => update("preferred_locations", v)} placeholder="Add a location" />
          </Card>

          <Card
            title="Experience"
            action={
              <button
                onClick={() => setEditingExperience((v) => !v)}
                style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", fontWeight: 600, color: "var(--primary)", background: "none", border: "none", cursor: "pointer" }}
              >
                {editingExperience ? "Done" : "Edit"}
              </button>
            }
          >
            {profile.experience.length === 0 && !editingExperience ? (
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--muted-foreground)" }}>
                Nothing here yet.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {profile.experience.map((item, i) =>
                  editingExperience ? (
                    <div key={i} style={{ background: "var(--muted)", borderRadius: "8px", padding: "14px" }}>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label style={smallLabelStyle}>Title</label>
                          <input
                            value={item.title}
                            onChange={(e) => updateExperience(i, "title", e.target.value)}
                            placeholder="e.g. Software Engineering Intern"
                            style={{ ...inputStyle, background: "var(--card)" }}
                          />
                        </div>
                        <div>
                          <label style={smallLabelStyle}>Organization</label>
                          <input
                            value={item.organization}
                            onChange={(e) => updateExperience(i, "organization", e.target.value)}
                            placeholder="e.g. Comcast"
                            style={{ ...inputStyle, background: "var(--card)" }}
                          />
                        </div>
                      </div>
                      <div className="mb-3">
                        <label style={smallLabelStyle}>Dates</label>
                        <input
                          value={item.dates}
                          onChange={(e) => updateExperience(i, "dates", e.target.value)}
                          placeholder="e.g. Jun 2026 - Aug 2026"
                          style={{ ...inputStyle, background: "var(--card)", maxWidth: "240px" }}
                        />
                      </div>
                      <div>
                        <label style={smallLabelStyle}>What you did</label>
                        <textarea
                          value={item.highlight}
                          onChange={(e) => updateExperience(i, "highlight", e.target.value)}
                          rows={2}
                          placeholder="One sentence describing the work and its impact"
                          style={{ ...inputStyle, background: "var(--card)", resize: "vertical", lineHeight: 1.6 }}
                        />
                      </div>
                      <div style={{ textAlign: "right", marginTop: "8px" }}>
                        <button
                          onClick={() => removeExperience(i)}
                          style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "#DC2626", background: "none", border: "none", cursor: "pointer" }}
                        >
                          Remove entry
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={i} style={{ background: "var(--muted)", borderRadius: "8px", padding: "12px 14px" }}>
                      <div className="flex items-center justify-between">
                        <p style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.8375rem", color: "var(--foreground)" }}>
                          {item.title || "Untitled"}{item.organization && ` · ${item.organization}`}
                        </p>
                        <span style={{ fontFamily: "var(--font-mono-base)", fontSize: "0.6875rem", color: "var(--muted-foreground)" }}>
                          {item.dates}
                        </span>
                      </div>
                      {item.highlight && (
                        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--muted-foreground)", marginTop: "3px", lineHeight: 1.5 }}>
                          {item.highlight}
                        </p>
                      )}
                    </div>
                  ),
                )}
              </div>
            )}

            {editingExperience && (
              <button
                onClick={addExperience}
                style={{
                  marginTop: "12px", width: "100%", padding: "8px",
                  borderRadius: "6px", border: "1.5px dashed var(--border)", background: "transparent",
                  fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--muted-foreground)", cursor: "pointer",
                }}
              >
                + Add entry
              </button>
            )}

            {editingExperience && (
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--muted-foreground)", marginTop: "10px" }}>
                Changes are kept when you press Save changes below.
              </p>
            )}
          </Card>

          <div className="flex items-center gap-3">
            <button
              onClick={saveProfile}
              disabled={savingProfile}
              style={{
                background: "var(--primary)", color: "white", border: "none", borderRadius: "8px",
                padding: "10px 20px", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.875rem",
                cursor: savingProfile ? "not-allowed" : "pointer", opacity: savingProfile ? 0.6 : 1,
              }}
            >
              {savingProfile ? "Saving…" : "Save changes"}
            </button>
            {saved && (
              <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "#166534" }}>Saved</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "9px 12px",
  fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--foreground)",
  background: "var(--muted)", border: "1px solid var(--border)", borderRadius: "8px", outline: "none",
};

const smallLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)", fontSize: "0.75rem", fontWeight: 500,
  color: "var(--muted-foreground)", display: "block", marginBottom: "4px",
};

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", marginBottom: "16px" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: "12px" }}>
        <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.875rem", color: "var(--foreground)" }}>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", fontWeight: 500, color: "var(--foreground)", display: "block", marginBottom: "5px" }}>
        {label}
      </label>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </div>
  );
}

function TagEditor({ tags, onChange, placeholder }: { tags: string[]; onChange: (tags: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const value = draft.trim();
    if (value && !tags.includes(value)) onChange([...tags, value]);
    setDraft("");
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.length === 0 && (
          <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--muted-foreground)" }}>
            Nothing here yet.
          </span>
        )}
        {tags.map((tag) => (
          <span
            key={tag}
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              background: "var(--accent)", color: "var(--accent-foreground)",
              borderRadius: "100px", padding: "4px 10px",
              fontFamily: "var(--font-body)", fontSize: "0.75rem", fontWeight: 500,
            }}
          >
            {tag}
            <button
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              aria-label={`Remove ${tag}`}
              style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1, fontSize: "0.875rem" }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={add}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        style={{ ...inputStyle, maxWidth: "280px" }}
      />
    </div>
  );
}
