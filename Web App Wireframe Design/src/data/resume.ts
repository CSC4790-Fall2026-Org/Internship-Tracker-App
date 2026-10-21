import { supabase } from "../lib/supabase";
import type { CareerField, JobType } from "./jobs";

export interface ExperienceItem {
  title: string;
  organization: string;
  dates: string;
  highlight: string;
}

export interface ResumeProfile {
  id: string;
  file_name: string | null;
  full_name: string;
  email: string;
  phone: string;
  school: string;
  major: string;
  graduation: string;
  summary: string;
  skills: string[];
  interests: string[];
  preferred_locations: string[];
  experience: ExperienceItem[];
  job_type: JobType;
  career_fields: CareerField[];
  parsed_at: string | null;
}

export type UploadStage = "uploading" | "analyzing";

const MAX_BYTES = 5 * 1024 * 1024;

export async function saveJobType(profileId: string, jobType: JobType) {
  const { error } = await supabase.from("resume_profiles").update({ job_type: jobType }).eq("id", profileId);
  if (error) throw new Error(error.message);
}

// experience is jsonb, so it arrives as Json and needs narrowing.
export function toProfile(row: { experience: unknown; career_fields?: unknown }): ResumeProfile {
  return {
    ...(row as ResumeProfile),
    experience: (row.experience as ExperienceItem[]) ?? [],
    career_fields: Array.isArray(row.career_fields) ? (row.career_fields as CareerField[]) : [],
  };
}

export async function fetchResumeProfile(): Promise<ResumeProfile | null> {
  const { data, error } = await supabase.from("resume_profiles").select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toProfile(data) : null;
}

/** False for a profile made from the onboarding answers alone. */
export const hasResume = (profile: ResumeProfile) => profile.parsed_at !== null;

/** Whether there's enough to plan job searches from: a resume, or at least a field or major. */
export const canMatchJobs = (profile: ResumeProfile) =>
  hasResume(profile) || profile.career_fields.length > 0 || profile.major.trim() !== "" || profile.skills.length > 0;

/**
 * The profile, created if there isn't one yet. Accounts that finished onboarding before it saved to
 * resume_profiles have their answers waiting in user metadata; those seed the new row.
 */
export async function fetchOrCreateProfile(): Promise<ResumeProfile> {
  const existing = await fetchResumeProfile();
  if (existing) return existing;

  const { data: session } = await supabase.auth.getSession();
  const user = session.session?.user;
  if (!user) throw new Error("You need to be signed in.");
  const meta = user.user_metadata ?? {};
  const { data, error } = await supabase
    .from("resume_profiles")
    .upsert(
      {
        user_id: user.id,
        ...(typeof meta.job_type === "string" && { job_type: meta.job_type }),
        ...(Array.isArray(meta.career_fields) && { career_fields: meta.career_fields }),
      },
      { onConflict: "user_id" },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  if (meta.job_type !== undefined || meta.career_fields !== undefined) {
    // Moved to the profile; from here on that's the only copy.
    await supabase.auth.updateUser({ data: { job_type: null, career_fields: null } }).catch(() => {});
  }
  return toProfile(data);
}

/** Uploads the PDF to the user's own folder, then has the Edge Function parse it. */
export async function uploadAndParseResume(
  userId: string,
  file: File,
  onStage?: (stage: UploadStage) => void,
): Promise<ResumeProfile> {
  if (file.type !== "application/pdf") throw new Error("Please choose a PDF file.");
  if (file.size > MAX_BYTES) throw new Error("That file is larger than 5 MB.");

  onStage?.("uploading");
  // The parser fills in the resume fields and leaves job type and fields alone, so make sure the row
  // holding the onboarding answers exists first.
  await fetchOrCreateProfile();
  const path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
  const upload = await supabase.storage.from("resumes").upload(path, file, { contentType: "application/pdf" });
  if (upload.error) throw new Error(`Upload failed: ${upload.error.message}`);

  onStage?.("analyzing");
  const { data, error } = await supabase.functions.invoke("parse-resume", { body: { path } });
  if (error) throw new Error(await functionErrorMessage(error));
  return toProfile(data.profile);
}

export interface OnboardingPreferences {
  jobType: JobType;
  careerFields: CareerField[];
}

/**
 * What someone is looking for and their fields are chosen in onboarding, before any resume exists. They start
 * the profile, so the Jobs page can match on them until a resume fills in the rest.
 */
export async function saveOnboardingPreferences({ jobType, careerFields }: OnboardingPreferences) {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new Error("You need to be signed in.");
  const { error } = await supabase
    .from("resume_profiles")
    .upsert({ user_id: userId, job_type: jobType, career_fields: careerFields }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

/** invoke() reports only "non-2xx status code"; the real reason is in the response body. */
export async function functionErrorMessage(error: { message: string }): Promise<string> {
  const res = (error as { context?: Response }).context;
  if (res instanceof Response) {
    const body = await res.json().catch(() => null);
    if (body?.error) return body.error;
  }
  return error.message;
}
