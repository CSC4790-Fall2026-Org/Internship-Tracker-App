// "Import from posting" on the Add application form: sends a pasted job description (or a link) to the
// extract-job-posting Edge Function, which returns the structured fields. The AI keys stay server-side.
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { ExtractedPosting } from "./jobPostingForm";

export interface ExtractResult {
  posting: ExtractedPosting;
  source: "text" | "url";
  /** The description was longer than the model's limit, so only the start of it was read. */
  truncated: boolean;
}

export async function extractJobPosting(input: { text: string; url: string }): Promise<ExtractResult> {
  const text = input.text.trim();
  const url = input.url.trim();
  if (!text && !url) throw new Error("Paste the job description, or add a link to the posting.");

  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw new Error("You've been signed out. Sign in again to import a posting.");

  const { data, error } = await supabase.functions.invoke("extract-job-posting", {
    body: { text, url },
    timeout: 60_000,
  });
  if (!error) {
    if (!data?.posting) throw new Error("The import sent back something unexpected. Try again.");
    return data as ExtractResult;
  }

  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response;
    const body = await res.json().catch(() => null);
    if (res.status === 401) throw new Error("Your session has expired. Sign out and back in, then try again.");
    if (res.status === 404) throw new Error("Importing isn't set up yet: the extract-job-posting Edge Function hasn't been deployed.");
    throw new Error(body?.error ?? `Couldn't read the posting (error ${res.status}). Try again in a moment.`);
  }
  if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
    // invoke()'s timeout aborts the request, which surfaces as an AbortError inside a FunctionsFetchError.
    if (["AbortError", "TimeoutError"].includes((error.context as { name?: string } | undefined)?.name ?? "")) {
      throw new Error("Reading the posting took too long. Try again, or paste a shorter excerpt.");
    }
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  throw new Error(error.message);
}
