// LLM settings shared by every Edge Function that calls the model, so they all stay on the same providers.
// Both providers take the same OpenAI-style chat body (including a strict json_schema response_format),
// so the functions only build the body; this file decides where it goes.
//
// Secrets (Edge Functions -> Secrets in the dashboard), never in the frontend bundle:
//   GROQ_API_KEY   - from https://console.groq.com/keys
//   GEMINI_API_KEY - from https://aistudio.google.com/apikey

interface LlmTarget {
  name: string;
  url: string;
  keyEnv: string;
  model: string;
  // Overrides the body's reasoning_effort; the providers accept different values.
  reasoningEffort?: string;
}

// Tried in order. Groq answers in about a second but has a small free quota; when it's rate-limited,
// overloaded or the prompt is over its per-minute token cap, the request moves to Gemini (about 3 seconds).
// Both handle the strict schemas in parse-resume and jobs. If you change this list, check those still work.
export const LLM_TARGETS: LlmTarget[] = [
  {
    name: "Groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    keyEnv: "GROQ_API_KEY",
    model: "openai/gpt-oss-120b",
  },
  {
    name: "Gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    keyEnv: "GEMINI_API_KEY",
    model: "gemini-3.5-flash",
    // Thinking roughly doubles Gemini's response time and these tasks don't need it.
    reasoningEffort: "none",
  },
];

// Error message for the functions to return when no provider has a key set.
export function missingLlmKeyError(): string | null {
  if (LLM_TARGETS.some((t) => Deno.env.get(t.keyEnv))) return null;
  const names = LLM_TARGETS.map((t) => t.keyEnv).join(" or ");
  return `${names} is not set. Add it under Edge Functions -> Secrets in the Supabase dashboard.`;
}

// 413 is Groq's answer when one prompt is bigger than the free tier's tokens-per-minute cap.
const shouldFallBack = (status: number) => status === 413 || status === 429 || status >= 500;

// Posts an OpenAI-style chat completion to the first provider that answers. `body` is everything except `model`.
// Returns the last provider's response when every one fails, so callers still see its status and message.
export async function chatCompletion(body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  const targets = LLM_TARGETS.filter((t) => Deno.env.get(t.keyEnv));
  let res: Response | undefined;
  for (const [i, target] of targets.entries()) {
    const last = i === targets.length - 1;
    try {
      res = await fetch(target.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${Deno.env.get(target.keyEnv)}`, "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          ...body,
          model: target.model,
          ...(target.reasoningEffort ? { reasoning_effort: target.reasoningEffort } : {}),
        }),
      });
    } catch (e) {
      // A timeout covers the whole request, so it ends the chain; a network error moves on to the next provider.
      if (last || (e as Error).name === "TimeoutError" || (e as Error).name === "AbortError") throw e;
      console.warn(`${target.name} request failed (${(e as Error).message}); trying ${targets[i + 1].name}`);
      continue;
    }
    if (last || !shouldFallBack(res.status)) return res;
    console.warn(`${target.name} returned ${res.status}; trying ${targets[i + 1].name}`);
    await res.body?.cancel();
  }
  if (!res) throw new Error(missingLlmKeyError() ?? "No AI provider is configured.");
  return res;
}
