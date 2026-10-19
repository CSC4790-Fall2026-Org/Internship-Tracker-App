import { supabase } from "../lib/supabase";
import type { JobType } from "./jobs";

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
  parsed_at: string | null;
}

export type UploadStage = "uploading" | "analyzing";

const MAX_BYTES = 5 * 1024 * 1024;

export async function saveJobType(profileId: string, jobType: JobType) {
  const { error } = await supabase.from("resume_profiles").update({ job_type: jobType }).eq("id", profileId);
  if (error) throw new Error(error.message);
}

// experience is jsonb, so it arrives as Json and needs narrowing.
export function toProfile(row: { experience: unknown }): ResumeProfile {
  return { ...(row as ResumeProfile), experience: (row.experience as ExperienceItem[]) ?? [] };
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
  return applyPendingJobType(toProfile(data.profile));
}

/**
 * What someone is looking for can be chosen in onboarding before any resume exists. It waits on the account
 * until the first resume creates a profile, then moves there, where the Jobs page reads it.
 */
export async function saveCareerStage(jobType: JobType) {
  const { error } = await supabase.auth.updateUser({ data: { job_type: jobType } });
  if (error) throw new Error(error.message);
}

async function applyPendingJobType(profile: ResumeProfile): Promise<ResumeProfile> {
  if (profile.job_type !== "auto") return profile;
  const { data } = await supabase.auth.getSession();
  const pending = data.session?.user.user_metadata?.job_type as JobType | undefined;
  if (!pending || pending === "auto") return profile;
  try {
    await saveJobType(profile.id, pending);
    // Applied once; from here on the profile's own setting wins, even if it's changed back to Auto.
    await supabase.auth.updateUser({ data: { job_type: null } });
    return { ...profile, job_type: pending };
  } catch {
    // Not worth failing the upload over: the choice can still be made on Jobs or Profile.
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
