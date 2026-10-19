// Groq settings shared by every Edge Function that calls it, so they all stay on the same model.
// Strict JSON schemas on Groq only work on the gpt-oss models, which parse-resume and jobs rely on.
export const GROQ_MODEL = "openai/gpt-oss-120b";

export const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
