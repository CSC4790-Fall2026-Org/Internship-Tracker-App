// Backend for "Import from posting" on the Add application form.
//   { text?, url? }  ->  { posting, source: "text" | "url", truncated }
//
// Pulls company, title, location, deadline and so on out of a pasted job description, so the form can be
// pre-filled. Nothing is saved here: the user reviews the form and saves it as usual.
// With only a URL, it fetches the page and strips it to text (best effort; most big job boards block this).
//
// Secrets (Edge Functions -> Secrets in the dashboard), never in the frontend bundle:
//   GROQ_API_KEY, GEMINI_API_KEY - already set for parse-resume, jobs and career-coach (see _shared/llm.ts)
import { createClient } from "npm:@supabase/supabase-js@2";
import { chatCompletion, missingLlmKeyError } from "../_shared/llm.ts";
import { cleanPosting, extractionRequestBody, htmlToText, PostingParseError, truncatePosting } from "../_shared/jobPosting.ts";

// Shorter than this can't be a real posting; it's usually a title or a stray line.
const MIN_POSTING_CHARS = 80;
const MAX_URL_CHARS = 2_000;
const PAGE_TIMEOUT_MS = 10_000;
const MAX_PAGE_BYTES = 2_000_000;
const LLM_TIMEOUT_MS = 45_000;

const URL_FAILED = "Couldn't read that page. Paste the job description text instead.";

// Sites that block server-side fetches or only render with JavaScript; skip the request and say so.
const BLOCKED_HOSTS = ["linkedin.com", "indeed.com", "joinhandshake.com", "glassdoor.com", "ziprecruiter.com", "myworkdayjobs.com"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

// Refuses addresses inside a private network, so the function can't be pointed at internal services.
function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return true;
  if (host.includes(":")) return true; // IPv6 literals: public postings never need one
  const ip = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!ip) return false;
  const [a, b] = [Number(ip[1]), Number(ip[2])];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

function parsePostingUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    throw new HttpError(400, "That link doesn't look like a web address.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new HttpError(400, "Use a link that starts with http:// or https://.");
  if (isPrivateHost(url.hostname)) throw new HttpError(400, "That link points to a private address.");
  return url;
}

async function fetchPostingText(url: URL): Promise<string> {
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) throw new HttpError(422, URL_FAILED);

  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PipelineJobImport/1.0)", Accept: "text/html,text/plain" },
    });
  } catch {
    throw new HttpError(422, URL_FAILED);
  }
  // A redirect could land somewhere the original host check never saw.
  if (isPrivateHost(new URL(res.url || url.href).hostname)) throw new HttpError(422, URL_FAILED);
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !/text\/(html|plain)|application\/xhtml/i.test(type)) {
    await res.body?.cancel();
    throw new HttpError(422, URL_FAILED);
  }

  // Read at most MAX_PAGE_BYTES; a job page is far smaller, and this caps memory for anything that isn't.
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  let size = 0;
  while (size < MAX_PAGE_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
    size += value.length;
  }
  await reader.cancel();

  const text = /html/i.test(type) ? htmlToText(raw) : raw.trim();
  // Pages that build themselves with JavaScript come back as a near-empty shell.
  if (text.length < MIN_POSTING_CHARS * 3) throw new HttpError(422, URL_FAILED);
  return text;
}

async function extract(posting: string) {
  let res: Response;
  try {
    res = await chatCompletion(extractionRequestBody(posting), AbortSignal.timeout(LLM_TIMEOUT_MS));
  } catch (e) {
    if ((e as Error).name === "TimeoutError") throw new HttpError(504, "Reading the posting took too long. Try again, or paste a shorter excerpt.");
    throw new HttpError(502, "Couldn't reach the AI service. Try again in a moment.");
  }
  if (res.status === 429) {
    await res.body?.cancel();
    throw new HttpError(429, "The AI service is busy right now. Wait a minute and try again.");
  }
  if (!res.ok) {
    console.error(`AI request failed (${res.status}): ${(await res.text()).slice(0, 500)}`);
    throw new HttpError(502, `The AI service couldn't read the posting (error ${res.status}). Try again in a moment.`);
  }

  const completion = await res.json();
  const content = completion.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new HttpError(422, "The AI returned an empty answer. Try again.");
  }
  try {
    return cleanPosting(content);
  } catch (e) {
    if (e instanceof PostingParseError) throw new HttpError(422, e.message);
    throw e;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const keyError = missingLlmKeyError();
    if (keyError) return jsonResponse(500, { error: keyError });

    // Signed-in users only, so the AI quota can't be spent by anyone with the URL.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return jsonResponse(401, { error: "You need to be signed in." });

    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const urlInput = typeof body.url === "string" ? body.url.trim().slice(0, MAX_URL_CHARS) : "";

    if (!text && !urlInput) return jsonResponse(400, { error: "Paste the job description, or add a link to the posting." });
    if (text && text.length < MIN_POSTING_CHARS) {
      return jsonResponse(400, { error: "That's too short to be a job posting. Paste the full description." });
    }

    // Pasted text wins; the URL is only fetched when it's all we have.
    const source = text ? "text" : "url";
    const raw = text || (await fetchPostingText(parsePostingUrl(urlInput)));
    const { text: posting, truncated } = truncatePosting(raw);

    return jsonResponse(200, { posting: await extract(posting), source, truncated });
  } catch (e) {
    if (e instanceof HttpError) return jsonResponse(e.status, { error: e.message });
    console.error(e);
    return jsonResponse(500, { error: (e as Error).message });
  }
});
