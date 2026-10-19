import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import type { Json } from "../lib/database.types";
import { fetchResumeProfile, uploadAndParseResume, type ExperienceItem, type ResumeProfile, type UploadStage } from "../data/resume";
import { Banner, Button, Card, CardHeader, cx, Field, Input, Page, PageHeader, Skeleton, Spinner, Textarea } from "../components/ui";
import { useFeedback } from "../components/feedback";
import { IconAlertCircle, IconFile, IconPencil, IconPlus, IconSparkles, IconTrash, IconUpload, IconX } from "../components/icons";

type Stage = "idle" | UploadStage;

export default function AiCoach({ userId }: { userId: string }) {
  const { toast } = useFeedback();
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  // The last saved version, so unsaved edits can be discarded.
  const [savedProfile, setSavedProfile] = useState<ResumeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editingExperience, setEditingExperience] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchResumeProfile()
      .then((p) => {
        setProfile(p);
        setSavedProfile(p);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const parsed = await uploadAndParseResume(userId, file, setStage);
      setProfile(parsed);
      setSavedProfile(parsed);
      setDirty(false);
      toast("Resume read. Check the details below.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStage("idle");
    }
  };

  const update = <K extends keyof ResumeProfile>(field: K, value: ResumeProfile[K]) => {
    setProfile((p) => (p ? { ...p, [field]: value } : p));
    setDirty(true);
  };

  const updateExperience = (index: number, field: keyof ExperienceItem, value: string) =>
    update(
      "experience",
      profile!.experience.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );

  const removeExperience = (index: number) =>
    update(
      "experience",
      profile!.experience.filter((_, i) => i !== index),
    );

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
    if (error) {
      setError(error.message);
    } else {
      setSavedProfile(profile);
      setDirty(false);
      setEditingExperience(false);
      toast("Profile saved");
    }
  };

  const discard = () => {
    setProfile(savedProfile);
    setDirty(false);
    setEditingExperience(false);
  };

  const busy = stage !== "idle";

  return (
    <Page className={dirty ? "pb-28" : undefined}>
      <PageHeader title="Profile" description="Your resume powers job matches on the Jobs page. Check what we pulled out and fix anything we got wrong." />

      {error && (
        <Banner icon={IconAlertCircle} className="mb-5">
          {error}
        </Banner>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-3">
        {/* Resume */}
        <div className="flex flex-col gap-5 lg:sticky lg:top-8">
          <Card>
            <CardHeader icon={IconFile} title="Resume" />
            <div className="px-4 pb-4">
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) handleFile(file);
                }}
              />
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (!busy && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
                }}
                className={cx("flex flex-col items-center rounded-lg border border-dashed px-4 py-6 text-center transition-colors", dragOver ? "border-accent bg-accent-soft" : "border-line-strong bg-subtle")}
              >
                {busy ? (
                  <>
                    <Spinner size={22} className="mb-3 text-accent" />
                    <p className="text-ui font-medium text-fg">{stage === "uploading" ? "Uploading…" : "Reading your resume…"}</p>
                    <p className="mt-0.5 text-xs text-fg-muted">This usually takes a few seconds.</p>
                  </>
                ) : (
                  <>
                    <span className="mb-3 flex size-9 items-center justify-center rounded-lg border border-line bg-surface text-fg-muted">
                      <IconUpload size={17} />
                    </span>
                    <p className="text-ui font-medium text-fg">{profile ? "Drop a new version here" : "Drop your resume here"}</p>
                    <p className="mt-0.5 mb-3 text-xs text-fg-muted">PDF, up to 5 MB</p>
                    <Button size="sm" onClick={() => fileInput.current?.click()}>
                      {profile ? "Replace resume" : "Choose file"}
                    </Button>
                  </>
                )}
              </div>
              {profile?.file_name && !busy && (
                <div className="mt-3 flex items-center gap-2 rounded-md border border-line px-2.5 py-2">
                  <IconFile size={15} className="text-fg-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-ui text-fg">{profile.file_name}</p>
                    {profile.parsed_at && <p className="text-2xs text-fg-muted">Read {new Date(profile.parsed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>}
                  </div>
                </div>
              )}
            </div>
          </Card>
          <div className="flex gap-2.5 px-1 text-xs leading-relaxed text-fg-muted">
            <IconSparkles size={14} className="mt-0.5 text-accent" />
            <p>Skills, interests, graduation date and preferred locations decide which listings we search for and how they're ranked.</p>
          </div>
        </div>

        {/* Extracted profile */}
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          {loading ? (
            <Card className="space-y-3 p-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-2/3" />
            </Card>
          ) : !profile ? (
            <Card className="px-6 py-14 text-center">
              <p className="text-sm font-semibold text-fg">No profile yet</p>
              <p className="mx-auto mt-1 max-w-sm text-ui text-fg-muted">Upload a resume and we'll fill this in. You can edit everything afterwards.</p>
            </Card>
          ) : (
            <>
              <Section title="Basics">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name">
                    <Input value={profile.full_name} onChange={(e) => update("full_name", e.target.value)} />
                  </Field>
                  <Field label="Email">
                    <Input type="email" value={profile.email} onChange={(e) => update("email", e.target.value)} />
                  </Field>
                  <Field label="School">
                    <Input value={profile.school} onChange={(e) => update("school", e.target.value)} />
                  </Field>
                  <Field label="Major">
                    <Input value={profile.major} onChange={(e) => update("major", e.target.value)} />
                  </Field>
                  <Field label="Graduation" hint="Used to choose internships vs. full-time roles">
                    <Input value={profile.graduation} onChange={(e) => update("graduation", e.target.value)} placeholder="e.g. May 2027" />
                  </Field>
                </div>
              </Section>

              <Section title="Summary">
                <Textarea aria-label="Summary" rows={3} value={profile.summary} onChange={(e) => update("summary", e.target.value)} />
              </Section>

              <Section title="Skills" description="Press Enter or comma to add">
                <TagEditor label="skill" tags={profile.skills} onChange={(v) => update("skills", v)} placeholder="Add a skill" />
              </Section>

              <div className="grid gap-5 sm:grid-cols-2">
                <Section title="Interests">
                  <TagEditor label="interest" tags={profile.interests} onChange={(v) => update("interests", v)} placeholder="Add an interest" />
                </Section>
                <Section title="Preferred locations">
                  <TagEditor label="location" tags={profile.preferred_locations} onChange={(v) => update("preferred_locations", v)} placeholder="Add a location" />
                </Section>
              </div>

              <Section
                title="Experience"
                action={
                  <Button size="sm" variant="ghost" icon={editingExperience ? undefined : IconPencil} onClick={() => setEditingExperience((v) => !v)}>
                    {editingExperience ? "Done editing" : "Edit"}
                  </Button>
                }
              >
                {profile.experience.length === 0 && !editingExperience ? (
                  <p className="text-ui text-fg-muted">Nothing here yet.</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {profile.experience.map((item, i) =>
                      editingExperience ? (
                        <div key={i} className="rounded-lg border border-line bg-subtle p-3">
                          <div className="mb-3 grid gap-3 sm:grid-cols-2">
                            <Field label="Title">
                              <Input value={item.title} onChange={(e) => updateExperience(i, "title", e.target.value)} placeholder="e.g. Software Engineering Intern" />
                            </Field>
                            <Field label="Organization">
                              <Input value={item.organization} onChange={(e) => updateExperience(i, "organization", e.target.value)} placeholder="e.g. Comcast" />
                            </Field>
                            <Field label="Dates">
                              <Input value={item.dates} onChange={(e) => updateExperience(i, "dates", e.target.value)} placeholder="e.g. Jun 2026 – Aug 2026" />
                            </Field>
                          </div>
                          <Field label="What you did">
                            <Textarea rows={2} value={item.highlight} onChange={(e) => updateExperience(i, "highlight", e.target.value)} placeholder="One sentence describing the work and its impact" />
                          </Field>
                          <div className="mt-2 text-right">
                            <Button size="sm" variant="danger-ghost" icon={IconTrash} onClick={() => removeExperience(i)}>
                              Remove
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div key={i} className="rounded-lg border border-line px-3.5 py-3">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                            <p className="text-ui font-medium text-fg">
                              {item.title || "Untitled"}
                              {item.organization && <span className="font-normal text-fg-muted"> · {item.organization}</span>}
                            </p>
                            <span className="text-xs text-fg-muted">{item.dates}</span>
                          </div>
                          {item.highlight && <p className="mt-1 text-ui leading-relaxed text-fg-muted">{item.highlight}</p>}
                        </div>
                      ),
                    )}
                  </div>
                )}
                {editingExperience && (
                  <Button icon={IconPlus} onClick={addExperience} className="mt-3 w-full border-dashed">
                    Add entry
                  </Button>
                )}
              </Section>
            </>
          )}
        </div>
      </div>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 p-3 sm:p-4 lg:left-[var(--sidebar-w)]">
          <div className="mx-auto flex max-w-xl items-center gap-3 rounded-xl border border-line bg-surface py-2 pr-2 pl-4 shadow-dialog animate-toast-in">
            <span className="size-2 rounded-full bg-warning" aria-hidden="true" />
            <p className="flex-1 text-ui font-medium text-fg">Unsaved changes</p>
            <Button variant="ghost" onClick={discard} disabled={savingProfile}>
              Discard
            </Button>
            <Button variant="primary" onClick={saveProfile} loading={savingProfile}>
              Save changes
            </Button>
          </div>
        </div>
      )}
    </Page>
  );
}

function Section({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={description} action={action} />
      <div className="px-4 pb-4">{children}</div>
    </Card>
  );
}

function TagEditor({ tags, onChange, placeholder, label }: { tags: string[]; onChange: (tags: string[]) => void; placeholder: string; label: string }) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const value = draft.trim();
    if (value && !tags.includes(value)) onChange([...tags, value]);
    setDraft("");
  };

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-line bg-surface p-1.5 transition-[border-color,box-shadow] focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15">
      {tags.map((tag) => (
        <span key={tag} className="inline-flex h-6 items-center gap-1 rounded-md bg-muted pr-1 pl-2 text-xs font-medium text-fg-2">
          {tag}
          <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))} aria-label={`Remove ${tag}`} className="rounded p-0.5 text-fg-faint transition-colors hover:bg-muted-strong hover:text-fg">
            <IconX size={12} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        aria-label={`Add ${label}`}
        placeholder={tags.length === 0 ? placeholder : `+ ${label}`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={add}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !draft && tags.length > 0) {
            onChange(tags.slice(0, -1));
          }
        }}
        className="h-6 min-w-24 flex-1 bg-transparent px-1 text-ui text-fg placeholder:text-fg-faint focus:outline-none"
      />
    </div>
  );
}

