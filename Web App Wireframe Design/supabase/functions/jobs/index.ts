// Backend for the Jobs page. Two actions:
//   { action: "search", what, where, page, sort }  - browse Adzuna listings
//   { action: "recommend" }                        - AI-picked listings based on the user's resume profile
//
// Secrets (Edge Functions -> Secrets in the dashboard), never in the frontend bundle:
//   ADZUNA_APP_ID, ADZUNA_APP_KEY  - from https://developer.adzuna.com
//   GROQ_API_KEY                   - already set for parse-resume
//
// Every user of the app shares one Adzuna quota (free tier: 25/min, 250/day, 2,500/month),
// so recommendations are saved to job_recommendations and refreshes have a cooldown.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

// Same model as parse-resume: strict JSON schemas on Groq only work on the gpt-oss models.
const GROQ_MODEL = "openai/gpt-oss-120b";
const ADZUNA_COUNTRY = "us";
const PAGE_SIZE = 20;
const MAX_CANDIDATES = 40;
const MAX_RECOMMENDATIONS = 10;
const REFRESH_COOLDOWN_MINUTES = 10;

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
}

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
  query: { what: string; where: string; page: number; sort: string; maxDaysOld?: number },
): Promise<{ jobs: Job[]; total: number }> {
  const params = new URLSearchParams({
    app_id: credentials.appId,
    app_key: credentials.appKey,
    results_per_page: String(PAGE_SIZE),
    sort_by: query.sort,
    "content-type": "application/json",
  });
  if (query.what) params.set("what", query.what);
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
    jobs: results.map(toJob).filter((job) => job.id && job.url && job.title),
    total: typeof body.count === "number" ? body.count : 0,
  };
}

async function groqJson<T>(
  apiKey: string,
  name: string,
  schema: Record<string, unknown>,
  system: string,
  user: string,
): Promise<T> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      max_completion_tokens: 8000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
    }),
  });
  if (!res.ok) {
    throw new HttpError(502, `Groq request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const completion = await res.json();
  const content = completion.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new HttpError(502, "Groq returned an unexpected response shape.");
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new HttpError(502, "Groq returned a response that wasn't valid JSON.");
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

const SEARCH_PLAN_PROMPT = `You plan job searches for a student using a job board's keyword search.

Write exactly 3 searches that together cover the most promising directions for this student.

Rules:
- "what" is 2 to 4 words that would appear in a job title. Short queries match more listings.
- Decide between internships and full-time roles from the graduation date and today's date:
  - Graduating more than about 6 months from today: search internships (include "intern" in "what").
  - Graduating within about 6 months, or already graduated: search entry-level roles (e.g. "junior", "entry level", "new grad"). One internship search is fine as a fallback.
- "where" is one US city or state taken from the preferred locations. If there are none, or the preference is remote, use an empty string. For remote, add "remote" to "what" instead.
- Make the 3 searches different from each other: different roles or different locations, not rewordings.`;

function profileText(profile: Profile) {
  const experience = profile.experience
    .slice(0, 5)
    .map((e) => `- ${e.title ?? ""} at ${e.organization ?? ""}: ${e.highlight ?? ""}`)
    .join("\n");
  return [
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

const RANKING_PROMPT = `You match a student to job listings and explain each match.

From the listings provided, pick the ones that genuinely fit this student, best first, at most ${MAX_RECOMMENDATIONS}.

Rules:
- The reason is the most important part. Name concrete things from the student's profile (a skill, a project, a past role, an interest) and connect them to this listing. Never write a generic reason that could apply to anyone.
- Be honest. Leave out senior roles, roles demanding years of experience the student lacks, and roles in unrelated fields, even if that means returning fewer than ${MAX_RECOMMENDATIONS}.
- Listing descriptions are short, truncated snippets. Don't claim details the snippet doesn't contain.
- matched_skills must come from the student's profile, not the listing.
- Only use ids from the listings provided, copied exactly.`;

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

async function recommend(
  supabase: SupabaseClient,
  userId: string,
  credentials: { appId: string; appKey: string },
  groqKey: string,
) {
  const { data: existing } = await supabase
    .from("job_recommendations")
    .select("generated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) {
    const minutesAgo = (Date.now() - new Date(existing.generated_at as string).getTime()) / 60_000;
    if (minutesAgo < REFRESH_COOLDOWN_MINUTES) {
      const wait = Math.ceil(REFRESH_COOLDOWN_MINUTES - minutesAgo);
      throw new HttpError(429, `These were refreshed moments ago. You can refresh again in ${wait} minute${wait === 1 ? "" : "s"}.`);
    }
  }

  const { data: profileRow, error: profileError } = await supabase
    .from("resume_profiles")
    .select("school, major, graduation, summary, skills, interests, preferred_locations, experience")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError) throw new HttpError(500, `Couldn't read your profile: ${profileError.message}`);
  if (!profileRow) throw new HttpError(400, "Upload your resume on the Profile page first, so there's something to match against.");
  const profile = profileRow as unknown as Profile;
  profile.experience = Array.isArray(profile.experience) ? profile.experience : [];

  const today = new Date().toISOString().slice(0, 10);
  const plan = await groqJson<{ searches: Search[] }>(
    groqKey,
    "search_plan",
    SEARCH_PLAN_SCHEMA,
    SEARCH_PLAN_PROMPT,
    `Today is ${today}.\n\n${profileText(profile)}`,
  );
  const searches = plan.searches
    .map((s) => ({ what: s.what.trim().slice(0, 80), where: s.where.trim().slice(0, 80) }))
    .filter((s) => s.what)
    .slice(0, 3);
  if (searches.length === 0) throw new HttpError(502, "Couldn't work out what to search for from your profile.");

  const results = await Promise.all(
    searches.map((s) => adzunaSearch(credentials, { ...s, page: 1, sort: "relevance", maxDaysOld: 30 })),
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
    const ranked = await groqJson<{ recommendations: Ranked[] }>(
      groqKey,
      "job_ranking",
      RANKING_SCHEMA,
      RANKING_PROMPT,
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
      { user_id: userId, jobs, searches, generated_at: new Date().toISOString() },
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
      return jsonResponse(200, await adzunaSearch(credentials, { what, where, page, sort }));
    }

    if (body.action === "recommend") {
      const groqKey = Deno.env.get("GROQ_API_KEY");
      if (!groqKey) {
        return jsonResponse(500, { error: "GROQ_API_KEY is not set. Add it under Edge Functions -> Secrets in the Supabase dashboard." });
      }
      return jsonResponse(200, await recommend(supabase, auth.user.id, credentials, groqKey));
    }

    return jsonResponse(400, { error: 'Unknown action. Use "search" or "recommend".' });
  } catch (e) {
    if (e instanceof HttpError) return jsonResponse(e.status, { error: e.message });
    return jsonResponse(500, { error: (e as Error).message });
  }
});
