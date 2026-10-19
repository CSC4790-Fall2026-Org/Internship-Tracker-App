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

/** Uploads the PDF to the user's own folder, then has the Edge Function parse it. */
export async function uploadAndParseResume(
  userId: string,
  file: File,
  onStage?: (stage: UploadStage) => void,
): Promise<ResumeProfile> {
  if (file.type !== "application/pdf") throw new Error("Please choose a PDF file.");
  if (file.size > MAX_BYTES) throw new Error("That file is larger than 5 MB.");

  onStage?.("uploading");
  const path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
  const upload = await supabase.storage.from("resumes").upload(path, file, { contentType: "application/pdf" });
  if (upload.error) throw new Error(`Upload failed: ${upload.error.message}`);

  onStage?.("analyzing");
  const { data, error } = await supabase.functions.invoke("parse-resume", { body: { path } });
  if (error) throw new Error(await functionErrorMessage(error));
  return applyPendingPreferences(toProfile(data.profile));
}

export interface OnboardingPreferences {
  jobType: JobType;
  careerFields: CareerField[];
}

/**
 * What someone is looking for and their fields are chosen in onboarding, before any resume exists. They wait
 * on the account until the first resume creates a profile, then move there, where the Jobs page reads them.
 */
export async function saveOnboardingPreferences({ jobType, careerFields }: OnboardingPreferences) {
  const { error } = await supabase.auth.updateUser({ data: { job_type: jobType, career_fields: careerFields } });
  if (error) throw new Error(error.message);
}

async function applyPendingPreferences(profile: ResumeProfile): Promise<ResumeProfile> {
  const { data } = await supabase.auth.getSession();
  const meta = data.session?.user.user_metadata ?? {};
  const pendingType = meta.job_type as JobType | null | undefined;
  const pendingFields = Array.isArray(meta.career_fields) ? (meta.career_fields as CareerField[]) : [];
  // Only fill what the profile doesn't already have, e.g. a re-upload keeps choices made on Profile since.
  const patch = {
    ...(pendingType && pendingType !== "auto" && profile.job_type === "auto" && { job_type: pendingType }),
    ...(pendingFields.length > 0 && profile.career_fields.length === 0 && { career_fields: pendingFields }),
  };
  if (pendingType === undefined && !meta.career_fields) return profile;
  try {
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from("resume_profiles").update(patch).eq("id", profile.id);
      if (error) throw error;
    }
    // Applied once; from here on the profile's own settings win.
    await supabase.auth.updateUser({ data: { job_type: null, career_fields: null } });
    return { ...profile, ...patch };
  } catch {
    // Not worth failing the upload over: both can still be set on Profile.
    return profile;
  }
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
