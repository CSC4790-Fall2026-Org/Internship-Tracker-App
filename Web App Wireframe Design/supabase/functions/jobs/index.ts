// Backend for the Jobs page. Two actions:
//   { action: "search", what, where, page, sort }  - browse Adzuna listings
//   { action: "recommend", searches? }             - AI-picked listings based on the user's profile: the parsed
//                                                    resume, or until there is one, the onboarding answers.
//                                                    Without searches the AI plans them from the profile.
//
// Secrets (Edge Functions -> Secrets in the dashboard), never in the frontend bundle:
//   ADZUNA_APP_ID, ADZUNA_APP_KEY  - from https://developer.adzuna.com
//   GROQ_API_KEY, GEMINI_API_KEY   - already set for parse-resume (see _shared/llm.ts)
//
// Job type: "search" takes a jobType in the body; "recommend" reads resume_profiles.job_type.
//
// Every user of the app shares one Adzuna quota (free tier: 25/min, 250/day, 2,500/month),
// so recommendations are saved to job_recommendations and refreshes have a cooldown.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
// Same models as parse-resume, which handle the strict JSON schemas below.
import { chatCompletion, missingLlmKeyError } from "../_shared/llm.ts";

const ADZUNA_COUNTRY = "us";
const PAGE_SIZE = 20;
const MAX_CANDIDATES = 40;
const MAX_RECOMMENDATIONS = 10;
const MAX_SEARCHES = 5;
// Re-running the same searches waits longer than running new ones, since the results barely change.
const REFRESH_COOLDOWN_MINUTES = 10;
const CHANGED_COOLDOWN_MINUTES = 1;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPredicted: boolean;
  created: string;
  contractTime: string;
  category: string;
}

interface Search {
  what: string;
  where: string;
}

const JOB_TYPES = ["auto", "internship", "new_grad", "full_time", "part_time"] as const;
type JobType = (typeof JOB_TYPES)[number];

function toJobType(value: unknown): JobType {
  return JOB_TYPES.includes(value as JobType) ? (value as JobType) : "auto";
}

const INTERN_WORDS = /\b(intern|interns|internship|internships|co-?op)\b/i;
const SENIOR_WORDS = /\b(senior|sr|lead|principal|staff|manager|director|head|vp|architect)\b|\b(ii|iii|iv)\b/i;

// Adzuna has a part-time flag but nothing for internships or experience level, so those use keywords
// and a title check. (Adzuna's what_exclude can't do this: it matches the whole ad, and most
// entry-level ads mention a "manager" or "senior engineers" somewhere.)
function jobTypeQuery(jobType: JobType, what: string): { what: string; extra: Record<string, string> } {
  if (jobType === "internship") return { what: INTERN_WORDS.test(what) ? what : `${what} intern`.trim(), extra: {} };
  if (jobType === "part_time") return { what, extra: { part_time: "1" } };
  return { what, extra: {} };
}

function fitsJobType(jobType: JobType, title: string) {
  if (jobType === "auto" || jobType === "internship") return true;
  if (INTERN_WORDS.test(title)) return false;
  return jobType !== "new_grad" || !SENIOR_WORDS.test(title);
}

// The fields we use from an Adzuna result. Anything may be missing.
interface AdzunaResult {
  id?: string | number;
  title?: string;
  description?: string;
  redirect_url?: string;
  created?: string;
  contract_time?: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string | number;
  company?: { display_name?: string };
  location?: { display_name?: string };
  category?: { label?: string };
}

interface Profile {
  school: string;
  major: string;
  graduation: string;
  summary: string;
  skills: string[];
  interests: string[];
  preferred_locations: string[];
  experience: { title?: string; organization?: string; highlight?: string }[];
  career_fields: string[];
  parsed_at: string | null;
}

// Same codes as CAREER_FIELDS in the app and the check constraint on resume_profiles.career_fields.
const FIELD_LABEL: Record<string, string> = {
  software: "Software & IT",
  engineering: "Engineering",
  data: "Data & analytics",
  healthcare: "Healthcare",
  finance: "Finance & accounting",
  business: "Business & consulting",
  marketing: "Marketing & sales",
  design: "Design & creative",
  science: "Science & research",
  education: "Education",
  government: "Government & nonprofit",
  law: "Law & policy",
  media: "Media & communications",
};

const fieldsText = (fields: string[]) => fields.map((f) => FIELD_LABEL[f]).filter(Boolean).join(", ");

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Adzuna titles and snippets contain markup such as <strong> around matched keywords.
function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function toJob(r: AdzunaResult): Job {
  return {
    id: String(r.id ?? ""),
    title: stripHtml(r.title ?? ""),
    company: stripHtml(r.company?.display_name ?? ""),
    location: stripHtml(r.location?.display_name ?? ""),
    description: stripHtml(r.description ?? ""),
    url: r.redirect_url ?? "",
    salaryMin: typeof r.salary_min === "number" ? r.salary_min : null,
    salaryMax: typeof r.salary_max === "number" ? r.salary_max : null,
    salaryPredicted: String(r.salary_is_predicted ?? "0") === "1",
    created: r.created ?? "",
    contractTime: r.contract_time ?? "",
    category: r.category?.label ?? "",
  };
}

// Used to spot the same role listed twice, or a role the user already tracks.
function roleKey(company: string, title: string) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return `${norm(company)}|${norm(title)}`;
}

async function adzunaSearch(
  credentials: { appId: string; appKey: string },
  query: { what: string; where: string; page: number; sort: string; maxDaysOld?: number; jobType?: JobType },
): Promise<{ jobs: Job[]; total: number }> {
  const jobType = query.jobType ?? "auto";
  const { what, extra } = jobTypeQuery(jobType, query.what);
  const params = new URLSearchParams({
    app_id: credentials.appId,
    app_key: credentials.appKey,
    results_per_page: String(PAGE_SIZE),
    sort_by: query.sort,
    "content-type": "application/json",
  });
  if (what) params.set("what", what);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  if (query.where) {
    params.set("where", query.where);
    params.set("distance", "40"); // km, roughly 25 miles
  }
  if (query.maxDaysOld) params.set("max_days_old", String(query.maxDaysOld));

  const res = await fetch(`https://api.adzuna.com/v1/api/jobs/${ADZUNA_COUNTRY}/search/${query.page}?${params}`);
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new HttpError(502, "Adzuna rejected the API credentials. Check ADZUNA_APP_ID and ADZUNA_APP_KEY in Edge Function secrets.");
    }
    if (res.status === 429) {
      throw new HttpError(429, "The job search has hit its Adzuna rate limit. Try again in a minute.");
    }
    throw new HttpError(502, `Adzuna request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }

  const body = await res.json();
  const results: AdzunaResult[] = Array.isArray(body.results) ? body.results : [];
  return {
    jobs: results.map(toJob).filter((job) => job.id && job.url && job.title && fitsJobType(jobType, job.title)),
    total: typeof body.count === "number" ? body.count : 0,
  };
}

async function llmJson<T>(name: string, schema: Record<string, unknown>, system: string, user: string): Promise<T> {
  const res = await chatCompletion({
    temperature: 0.2,
    max_completion_tokens: 8000,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
  });
  if (!res.ok) {
    throw new HttpError(502, `AI request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const completion = await res.json();
  const content = completion.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new HttpError(502, "The AI returned an unexpected response shape.");
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new HttpError(502, "The AI returned a response that wasn't valid JSON.");
  }
}

// ---------- Step 1: turn the profile into a few Adzuna searches ----------

const SEARCH_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["searches"],
  properties: {
    searches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["what", "where"],
        properties: {
          what: { type: "string", description: 'Two to four words that would appear in a job title, e.g. "software engineer intern".' },
          where: { type: "string", description: 'A US city or state, e.g. "Philadelphia" or "New Jersey". Empty string for nationwide.' },
        },
      },
    },
  },
};

// What the user said they want. "auto" leaves it to the model, using the graduation date.
const JOB_TYPE_RULE: Record<JobType, string> = {
  // New grad hiring runs 9-12 months ahead, so a senior recruiting in the fall wants full-time roles, not internships.
  auto: `- Decide between internships and full-time roles from the graduation date and today's date:
  - Graduating more than about 12 months from today: search internships (include "intern" in "what").
  - Graduating within about 12 months, or already graduated: search new grad / entry-level roles (e.g. "new grad", "entry level", "junior"). Never include "intern".`,
  internship: `- The student wants internships. Include "intern" in every "what".`,
  new_grad: `- The student wants full-time new grad / entry-level roles. Never include "intern". Phrases like "new grad", "entry level" or "junior" are good in "what", but plain role titles (e.g. "software engineer") are fine too.`,
  full_time: `- The student wants full-time roles. Never include "intern". Use plain role titles; don't add seniority words.`,
  part_time: `- The student wants part-time roles. Never include "intern". Use plain role titles.`,
};

const JOB_TYPE_LABEL: Record<JobType, string> = {
  auto: "",
  internship: "internships",
  new_grad: "full-time new grad / entry-level roles",
  full_time: "full-time roles",
  part_time: "part-time roles",
};

const searchPlanPrompt = (jobType: JobType) => `You plan job searches for a student using a job board's keyword search.

Write exactly 3 searches that together cover the most promising directions for this student.

Rules:
- "what" is 2 to 4 words that would appear in a job title. Short queries match more listings.
${JOB_TYPE_RULE[jobType]}
- "where" is one US city or state taken from the preferred locations. If there are none, or the preference is remote, use an empty string. For remote, add "remote" to "what" instead.
- Make the 3 searches different from each other: different roles or different locations, not rewordings.
- If the profile lists Fields, every search must be a role in one of them, spread across them when there are several. The fields say what kind of work the student wants; don't drift into another field just because a skill would fit there.
- If the student hasn't uploaded a resume, plan broad, common entry-level roles in their fields and major rather than niche ones.`;

function profileText(profile: Profile) {
  const experience = profile.experience
    .slice(0, 5)
    .map((e) => `- ${e.title ?? ""} at ${e.organization ?? ""}: ${e.highlight ?? ""}`)
    .join("\n");
  return [
    `Resume: ${profile.parsed_at ? "uploaded" : "not uploaded yet, so only what the student chose at sign-up is known"}`,
    `Fields: ${fieldsText(profile.career_fields) || "not stated"}`,
    `School: ${profile.school || "unknown"}`,
    `Major: ${profile.major || "unknown"}`,
    `Graduation: ${profile.graduation || "unknown"}`,
    `Summary: ${profile.summary || "none"}`,
    `Skills: ${profile.skills.join(", ") || "none listed"}`,
    `Interests: ${profile.interests.join(", ") || "none listed"}`,
    `Preferred locations: ${profile.preferred_locations.join(", ") || "none stated"}`,
    `Experience:\n${experience || "- none listed"}`,
  ].join("\n");
}

// ---------- Step 2: rank the listings those searches returned ----------

const RANKING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["recommendations"],
  properties: {
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "score", "reason", "matched_skills"],
        properties: {
          id: { type: "string", description: "The listing id, copied exactly." },
          score: { type: "integer", description: "0 to 100: how well this role fits the student." },
          reason: {
            type: "string",
            description: 'One or two sentences addressed to the student ("you") on why this role fits them specifically.',
          },
          matched_skills: {
            type: "array",
            items: { type: "string" },
            description: "Up to 4 of the student's own skills or experiences that this role uses.",
          },
        },
      },
    },
  },
};

const rankingPrompt = (jobType: JobType) => `You match a student to job listings and explain each match.

From the listings provided, pick the ones that genuinely fit this student, best first, at most ${MAX_RECOMMENDATIONS}.

Rules:
- The reason is the most important part. Name concrete things from the student's profile (a skill, a project, a past role, an interest) and connect them to this listing. Never write a generic reason that could apply to anyone.
- Be honest. Leave out senior roles, roles demanding years of experience the student lacks, and roles in unrelated fields, even if that means returning fewer than ${MAX_RECOMMENDATIONS}.
- Listing descriptions are short, truncated snippets. Don't claim details the snippet doesn't contain.
- matched_skills must come from the student's profile, not the listing.
- Only use ids from the listings provided, copied exactly.
- If the profile lists Fields, leave out listings outside them.
- If the student hasn't uploaded a resume, there's little to go on: base the reason on their fields, major and what they're looking for, never invent skills or experience, and leave matched_skills empty unless the profile lists skills.${
  jobType === "auto" ? "" : `\n- The student is looking for ${JOB_TYPE_LABEL[jobType]}. Leave out listings of any other kind.`
}`;

interface Ranked {
  id: string;
  score: number;
  reason: string;
  matched_skills: string[];
}

// Interleave results so each search is represented, not just the first one.
function interleave(lists: Job[][]) {
  const out: Job[] = [];
  for (let i = 0; out.length < lists.reduce((n, l) => n + l.length, 0); i++) {
    for (const list of lists) if (list[i]) out.push(list[i]);
  }
  return out;
}

function sameSearches(a: Search[], b: Search[] | null) {
  const key = (list: Search[]) => list.map((s) => `${s.what.toLowerCase()}|${s.where.toLowerCase()}`).sort().join("\n");
  return Array.isArray(b) && key(a) === key(b);
}

// Searches the user typed. Returns null when there are none, meaning "let the AI plan them".
function toCustomSearches(value: unknown): Search[] | null {
  if (!Array.isArray(value)) return null;
  const searches = value
    .filter((s): s is Search => typeof s?.what === "string" && typeof s?.where === "string")
    .map((s) => ({ what: s.what.trim().slice(0, 80), where: s.where.trim().slice(0, 80) }))
    .filter((s) => s.what);
  if (searches.length > MAX_SEARCHES) throw new HttpError(400, `Use at most ${MAX_SEARCHES} searches.`);
  return searches.length > 0 ? searches : null;
}

async function recommend(
  supabase: SupabaseClient,
  userId: string,
  credentials: { appId: string; appKey: string },
  customSearches: Search[] | null,
) {
  const { data: profileRow, error: profileError } = await supabase
    .from("resume_profiles")
    .select("school, major, graduation, summary, skills, interests, preferred_locations, experience, job_type, career_fields, parsed_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError) throw new HttpError(500, `Couldn't read your profile: ${profileError.message}`);
  const profile = profileRow as unknown as Profile | null;
  if (profile) {
    profile.experience = Array.isArray(profile.experience) ? profile.experience : [];
    profile.career_fields = Array.isArray(profile.career_fields) ? profile.career_fields : [];
  }
  // Without a resume, the fields picked at sign-up (or a major or skills typed on Profile) are enough to go on.
  // Same check as canMatchJobs in the app.
  if (!profile || (!profile.parsed_at && profile.career_fields.length === 0 && !profile.major?.trim() && profile.skills.length === 0)) {
    throw new HttpError(400, "Upload your resume or pick your field on the Profile page first, so there's something to match against.");
  }
  const jobType = toJobType(profileRow!.job_type);

  const { data: existing } = await supabase
    .from("job_recommendations")
    .select("generated_at, job_type, career_fields, searches")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) {
    // A new job type, new fields or edited searches is a new question, so it gets the short cooldown.
    const sameFields = [...(existing.career_fields ?? [])].sort().join() === [...profile.career_fields].sort().join();
    const repeat = existing.job_type === jobType && sameFields && (!customSearches || sameSearches(customSearches, existing.searches as Search[]));
    const cooldown = repeat ? REFRESH_COOLDOWN_MINUTES : CHANGED_COOLDOWN_MINUTES;
    const minutesAgo = (Date.now() - new Date(existing.generated_at as string).getTime()) / 60_000;
    if (minutesAgo < cooldown) {
      const wait = Math.ceil(cooldown - minutesAgo);
      throw new HttpError(
        429,
        repeat
          ? `These searches were just run, so results won't have changed yet. Refresh again in ${wait} minute${wait === 1 ? "" : "s"}, or change the job type, fields or searches to look for something different now.`
          : `Recommendations were just updated. Try again in ${wait} minute${wait === 1 ? "" : "s"}.`,
      );
    }
  }

  let searches = customSearches;
  if (!searches) {
    const today = new Date().toISOString().slice(0, 10);
    const plan = await llmJson<{ searches: Search[] }>(
      "search_plan",
      SEARCH_PLAN_SCHEMA,
      searchPlanPrompt(jobType),
      `Today is ${today}.\n\n${profileText(profile)}`,
    );
    searches = plan.searches
      .map((s) => ({
        // The model is told this, but enforce it: an "intern" keyword would undo the job type filter.
        what: (jobType === "auto" || jobType === "internship" ? s.what : s.what.replace(INTERN_WORDS, " ")).replace(/\s+/g, " ").trim().slice(0, 80),
        where: s.where.trim().slice(0, 80),
      }))
      .filter((s) => s.what)
      .slice(0, 3);
    if (searches.length === 0) throw new HttpError(502, "Couldn't work out what to search for from your profile.");
  }

  const results = await Promise.all(
    searches.map((s) => adzunaSearch(credentials, { ...s, page: 1, sort: "relevance", maxDaysOld: 30, jobType })),
  );

  // Skip roles the user already tracks; they don't need recommending.
  const { data: tracked } = await supabase.from("applications").select("company, position");
  const seen = new Set((tracked ?? []).map((a) => roleKey(a.company as string, a.position as string)));
  const seenIds = new Set<string>();
  const candidates: Job[] = [];
  for (const job of interleave(results.map((r) => r.jobs))) {
    const key = roleKey(job.company, job.title);
    if (seenIds.has(job.id) || seen.has(key)) continue;
    seenIds.add(job.id);
    seen.add(key);
    candidates.push(job);
    if (candidates.length >= MAX_CANDIDATES) break;
  }

  let jobs: (Job & { score: number; reason: string; matchedSkills: string[] })[] = [];
  if (candidates.length > 0) {
    const listings = candidates
      .map((job) =>
        JSON.stringify({
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          snippet: job.description.slice(0, 350),
        }),
      )
      .join("\n");
    const ranked = await llmJson<{ recommendations: Ranked[] }>(
      "job_ranking",
      RANKING_SCHEMA,
      rankingPrompt(jobType),
      `Student profile:\n${profileText(profile)}\n\nListings (one JSON object per line):\n${listings}`,
    );

    const byId = new Map(candidates.map((job) => [job.id, job]));
    const used = new Set<string>();
    for (const r of ranked.recommendations) {
      const job = byId.get(r.id);
      if (!job || used.has(r.id)) continue; // ignore ids the model invented or repeated
      used.add(r.id);
      jobs.push({
        ...job,
        score: Math.max(0, Math.min(100, Math.round(r.score))),
        reason: r.reason.trim(),
        matchedSkills: r.matched_skills.slice(0, 4),
      });
    }
    jobs = jobs.sort((a, b) => b.score - a.score).slice(0, MAX_RECOMMENDATIONS);
  }

  const { data: saved, error: saveError } = await supabase
    .from("job_recommendations")
    .upsert(
      { user_id: userId, jobs, searches, job_type: jobType, career_fields: profile.career_fields, generated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    )
    .select()
    .single();
  if (saveError) throw new HttpError(500, `Couldn't save recommendations: ${saveError.message}`);

  return { recommendations: saved, candidates: candidates.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const appId = Deno.env.get("ADZUNA_APP_ID");
    const appKey = Deno.env.get("ADZUNA_APP_KEY");
    if (!appId || !appKey) {
      return jsonResponse(500, {
        error: "ADZUNA_APP_ID and ADZUNA_APP_KEY are not set. Add them under Edge Functions -> Secrets in the Supabase dashboard.",
      });
    }
    const credentials = { appId, appKey };

    // Act as the calling user so table access stays under row-level security.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    // Signed-in users only, so the shared Adzuna quota can't be spent by anyone with the URL.
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return jsonResponse(401, { error: "You need to be signed in." });

    const body = await req.json().catch(() => ({}));

    if (body.action === "search") {
      const what = typeof body.what === "string" ? body.what.trim().slice(0, 100) : "";
      const where = typeof body.where === "string" ? body.where.trim().slice(0, 100) : "";
      const page = Number.isInteger(body.page) && body.page >= 1 && body.page <= 50 ? body.page : 1;
      const sort = body.sort === "date" ? "date" : "relevance";
      const jobType = toJobType(body.jobType);
      return jsonResponse(200, await adzunaSearch(credentials, { what, where, page, sort, jobType }));
    }

    if (body.action === "recommend") {
      const keyError = missingLlmKeyError();
      if (keyError) return jsonResponse(500, { error: keyError });
      return jsonResponse(200, await recommend(supabase, auth.user.id, credentials, toCustomSearches(body.searches)));
    }

    return jsonResponse(400, { error: 'Unknown action. Use "search" or "recommend".' });
  } catch (e) {
    if (e instanceof HttpError) return jsonResponse(e.status, { error: e.message });
    return jsonResponse(500, { error: (e as Error).message });
  }
});
