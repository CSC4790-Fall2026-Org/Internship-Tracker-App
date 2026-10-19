import { useRef, useState } from "react";
import { saveCareerStage, uploadAndParseResume, type ResumeProfile, type UploadStage } from "../data/resume";
import { CAREER_STAGES, type JobType } from "../data/jobs";
import { Banner, Button, cx, Spinner } from "../components/ui";
import { BrandMark } from "../components/NavBar";
import { IconAlertCircle, IconCheck, IconUpload } from "../components/icons";

interface OnboardingProps {
  userId: string;
  userName: string;
  /** Marks onboarding finished and drops the user into the app. */
  onFinish: () => void;
}

export default function Onboarding({ userId, userName, onFinish }: OnboardingProps) {
  const [step, setStep] = useState<"looking-for" | "resume">("looking-for");
  const [stage, setStage] = useState<UploadStage | null>(null);
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
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
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[520px]">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <BrandMark size={26} />
          <span className="text-[15px] font-semibold tracking-[-0.015em]">Pipeline</span>
        </div>

        <div className="rounded-dialog border border-line bg-surface p-6 shadow-xs sm:p-8">
          {step === "looking-for" ? (
            <LookingFor firstName={firstName} onDone={() => setStep("resume")} />
          ) : profile ? (
            <ProfileConfirmation
              profile={profile}
              onFinish={onFinish}
              onRetry={() => {
                setProfile(null);
                setError(null);
              }}
            />
          ) : (
            <>
              <p className="text-ui font-medium text-accent-fg">Step 2 of 2 · Optional</p>
              <h1 className="mt-1.5 text-xl font-semibold tracking-[-0.015em] text-fg">Add your resume</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">We'll pull out your skills, experience and preferences. It powers your job matches, and you won't have to retype any of it.</p>

              {error && (
                <Banner icon={IconAlertCircle} className="mt-5">
                  {error}
                </Banner>
              )}

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
                className={cx("mt-6 flex flex-col items-center rounded-xl border border-dashed px-6 py-8 text-center transition-colors", dragOver ? "border-accent bg-accent-soft" : "border-line-strong bg-subtle")}
              >
                {busy ? (
                  <>
                    <Spinner size={22} className="mb-3 text-accent" />
                    <p className="text-sm font-medium text-fg">{stage === "uploading" ? "Uploading…" : "Reading your resume…"}</p>
                    <p className="mt-0.5 text-xs text-fg-muted">This usually takes a few seconds.</p>
                  </>
                ) : (
                  <>
                    <span className="mb-3 flex size-10 items-center justify-center rounded-lg border border-line bg-surface text-fg-muted">
                      <IconUpload size={18} />
                    </span>
                    <p className="text-sm font-medium text-fg">Drop your resume here</p>
                    <p className="mt-0.5 mb-4 text-xs text-fg-muted">PDF, up to 5 MB</p>
                    <Button variant="primary" onClick={() => fileInput.current?.click()}>
                      Choose file
                    </Button>
                  </>
                )}
              </div>

              <div className="mt-6 flex items-center justify-between gap-4 border-t border-line pt-5">
                <p className="text-xs text-fg-muted">You can add it later from Profile.</p>
                <Button variant="ghost" onClick={onFinish} disabled={busy}>
                  Skip for now
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LookingFor({ firstName, onDone }: { firstName: string; onDone: () => void }) {
  const [choice, setChoice] = useState<JobType | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = async () => {
    if (!choice) return;
    setSaving(true);
    setError(null);
    try {
      await saveCareerStage(choice);
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <>
      <p className="text-ui font-medium text-accent-fg">Step 1 of 2</p>
      <h1 className="mt-1.5 text-xl font-semibold tracking-[-0.015em] text-fg">Welcome, {firstName}</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">What are you looking for? This decides which listings the Jobs page finds for you.</p>

      {error && (
        <Banner icon={IconAlertCircle} className="mt-5">
          Couldn't save that: {error}
        </Banner>
      )}

      <div role="radiogroup" aria-label="What are you looking for?" className="mt-5 space-y-2">
        {CAREER_STAGES.map((option) => {
          const selected = choice === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setChoice(option.value)}
              className={cx(
                "tactile-soft flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors",
                selected ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong hover:bg-subtle",
              )}
            >
              <span className={cx("flex size-4 shrink-0 items-center justify-center rounded-full border", selected ? "border-accent bg-accent text-white" : "border-line-strong bg-surface")} aria-hidden="true">
                {selected && <IconCheck size={10} strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-fg">{option.label}</span>
                <span className="block text-xs text-fg-muted">{option.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <Button variant="primary" size="lg" onClick={next} loading={saving} disabled={!choice} className="mt-6 w-full">
        Continue
      </Button>
      <p className="mt-2.5 text-center text-xs text-fg-muted">You can change this any time on the Jobs or Profile page.</p>
    </>
  );
}

function ProfileConfirmation({ profile, onFinish, onRetry }: { profile: ResumeProfile; onFinish: () => void; onRetry: () => void }) {
  const rows = [
    { label: "Name", value: profile.full_name },
    { label: "School", value: profile.school },
    { label: "Major", value: profile.major },
    { label: "Graduation", value: profile.graduation },
    { label: "Looking for", value: CAREER_STAGES.find((s) => s.value === profile.job_type && s.value !== "auto")?.hint ?? "" },
    { label: "Skills", value: profile.skills.slice(0, 6).join(", ") + (profile.skills.length > 6 ? ` +${profile.skills.length - 6} more` : "") },
    { label: "Experience", value: `${profile.experience.length} ${profile.experience.length === 1 ? "entry" : "entries"}` },
  ].filter((row) => row.value);

  return (
    <>
      <div className="flex items-center gap-2.5">
        <span className="flex size-6 items-center justify-center rounded-full bg-success-soft text-success-fg">
          <IconCheck size={13} strokeWidth={2.75} />
        </span>
        <h1 className="text-xl font-semibold tracking-[-0.015em] text-fg">Here's what we found</h1>
      </div>
      <p className="mt-1.5 text-sm text-fg-muted">You can correct any of this later in Profile.</p>

      <dl className="mt-5 divide-y divide-line rounded-lg border border-line">
        {rows.map((row) => (
          <div key={row.label} className="flex gap-4 px-4 py-2.5">
            <dt className="w-24 shrink-0 text-ui text-fg-muted">{row.label}</dt>
            <dd className="min-w-0 text-ui text-fg">{row.value}</dd>
          </div>
        ))}
      </dl>

      <Button variant="primary" size="lg" onClick={onFinish} className="mt-6 w-full">
        Continue to Pipeline
      </Button>
      <div className="mt-2 text-center">
        <Button variant="ghost" onClick={onRetry}>
          Upload a different file
        </Button>
      </div>
    </>
  );
}
