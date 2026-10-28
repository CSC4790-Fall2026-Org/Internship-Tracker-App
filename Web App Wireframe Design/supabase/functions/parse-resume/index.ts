// Reads a resume PDF the user uploaded to the "resumes" bucket, asks the model to pull out a
// structured profile, and saves it to resume_profiles.
//
// The AI keys live here as secrets, never in the frontend bundle (see _shared/llm.ts):
//   supabase secrets set GROQ_API_KEY=... GEMINI_API_KEY=...
//
// We send the model text, not the PDF, so we extract the text first with unpdf.
// That means a scanned/image-only resume yields nothing - handled explicitly below.
import { createClient } from "npm:@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "npm:unpdf";
// Strict structured outputs keep the reply schema-valid. If you change LLM_TARGETS, check this schema still works.
import { chatCompletion, missingLlmKeyError } from "../_shared/llm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Strict mode requires every property listed in `required` and additionalProperties: false.
const PROFILE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "full_name",
    "email",
    "phone",
    "school",
    "major",
    "graduation",
    "summary",
    "skills",
    "interests",
    "preferred_locations",
    "experience",
  ],
  properties: {
    full_name: { type: "string", description: "The candidate's full name, or empty string if absent." },
    email: { type: "string" },
    phone: { type: "string" },
    school: { type: "string", description: "University or college name." },
    major: { type: "string", description: 'Field of study. Append any minor, e.g. "Computer Science, minor in Statistics".' },
    graduation: { type: "string", description: 'Expected graduation, as written, e.g. "May 2027".' },
    summary: {
      type: "string",
      description: "Two or three sentences describing this candidate to a recruiter, written in the third person.",
    },
    skills: {
      type: "array",
      items: { type: "string" },
      description: "Concrete skills: languages, frameworks, tools, methods. No soft skills.",
    },
    interests: {
      type: "array",
      items: { type: "string" },
      description:
        "Fields or industries this person appears drawn to, inferred from projects and coursework. Never a place name - locations belong in preferred_locations.",
    },
    preferred_locations: {
      type: "array",
      items: { type: "string" },
      description: "Locations stated on the resume. Empty array if none are stated; do not guess.",
    },
    experience: {
      type: "array",
      description: "Jobs, internships, research and substantial projects, most recent first.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "organization", "dates", "highlight"],
        properties: {
          title: { type: "string" },
          organization: { type: "string" },
          dates: { type: "string", description: 'As written, e.g. "Jun 2026 - Aug 2026".' },
          highlight: { type: "string", description: "One sentence on what they actually did." },
        },
      },
    },
  },
};

const SYSTEM_PROMPT = `You extract structured profiles from student resumes for an internship matching tool.

The text you receive was extracted from a PDF, so columns and tables may be interleaved or out of order. Read past that.

Rules:
- Only report what the resume supports. Use an empty string or empty array when something is absent.
- The one exception is "interests" and "summary", which you infer from the person's projects, coursework and experience.
- Never invent employers, schools, dates or contact details.
- Keep locations out of "interests"; they belong in "preferred_locations".`;

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const keyError = missingLlmKeyError();
    if (keyError) return jsonResponse(500, { error: keyError });

    // Act as the calling user so storage and table access stay under row-level security.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return jsonResponse(401, { error: "You need to be signed in." });

    const { path } = await req.json().catch(() => ({ path: null }));
    if (typeof path !== "string" || !path.startsWith(`${auth.user.id}/`)) {
      return jsonResponse(400, { error: "Invalid file path." });
    }

    const { data: file, error: downloadError } = await supabase.storage.from("resumes").download(path);
    if (downloadError || !file) {
      return jsonResponse(404, { error: `Couldn't read the uploaded file: ${downloadError?.message ?? "not found"}` });
    }

    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const { text: resumeText } = await extractText(pdf, { mergePages: true });

    if (!resumeText || resumeText.trim().length < 50) {
      return jsonResponse(422, {
        error: "We couldn't find any text in that PDF. If it's a scan or an image, export a text-based PDF and try again.",
      });
    }

    const llmResponse = await chatCompletion({
      temperature: 0,
      max_completion_tokens: 8000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Extract this student's profile from their resume:\n\n${resumeText}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "resume_profile", strict: true, schema: PROFILE_SCHEMA },
      },
    });

    if (!llmResponse.ok) {
      const detail = await llmResponse.text();
      return jsonResponse(502, { error: `AI request failed (${llmResponse.status}): ${detail.slice(0, 400)}` });
    }

    const completion = await llmResponse.json();
    const content = completion.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return jsonResponse(502, { error: "The AI returned an unexpected response shape." });
    }

    let profile;
    try {
      profile = JSON.parse(content);
    } catch {
      return jsonResponse(502, { error: "The AI returned a response that wasn't valid JSON." });
    }

    const { data: saved, error: saveError } = await supabase
      .from("resume_profiles")
      .upsert(
        {
          user_id: auth.user.id,
          file_path: path,
          file_name: path.split("/").slice(1).join("/"),
          full_name: profile.full_name ?? "",
          email: profile.email ?? "",
          phone: profile.phone ?? "",
          school: profile.school ?? "",
          major: profile.major ?? "",
          graduation: profile.graduation ?? "",
          summary: profile.summary ?? "",
          skills: profile.skills ?? [],
          interests: profile.interests ?? [],
          preferred_locations: profile.preferred_locations ?? [],
          experience: profile.experience ?? [],
          parsed_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select()
      .single();

    if (saveError) return jsonResponse(500, { error: `Couldn't save the profile: ${saveError.message}` });

    return jsonResponse(200, { profile: saved, usage: completion.usage });
  } catch (e) {
    return jsonResponse(500, { error: (e as Error).message });
  }
});
