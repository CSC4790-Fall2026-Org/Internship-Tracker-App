// LLM settings shared by every Edge Function that calls the model, so they all stay on the same provider.
// Gemini's OpenAI-compatible endpoint takes the same chat request body (and strict json_schema response_format)
// that we used with Groq, so the functions only build the body; this file decides where it goes.
//
// Secret (Edge Functions -> Secrets in the dashboard), never in the frontend bundle:
//   GEMINI_API_KEY - from https://aistudio.google.com/apikey
export const LLM_KEY_ENV = "GEMINI_API_KEY";

export const LLM_CHAT_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

// Tried in order: when a model is rate-limited (429) or overloaded (503), the request moves to the next one.
// Both handle the strict schemas in parse-resume and jobs; Flash-Lite is slower here but has its own quota.
export const LLM_MODELS = ["gemini-3.5-flash", "gemini-3.5-flash-lite"];

// Posts an OpenAI-style chat completion. `body` is everything except `model`.
export async function chatCompletion(apiKey: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  let res!: Response;
  for (const [i, model] of LLM_MODELS.entries()) {
    res = await fetch(LLM_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({ ...body, model }),
    });
    if ((res.status !== 429 && res.status !== 503) || i === LLM_MODELS.length - 1) return res;
    console.warn(`${model} returned ${res.status}; trying ${LLM_MODELS[i + 1]}`);
    await res.body?.cancel();
  }
  return res;
}
