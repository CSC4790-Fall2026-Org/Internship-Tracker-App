// Runs real extractions on the sample postings in tests/fixtures/job-postings, through the same prompt,
// provider chain (_shared/llm.ts) and cleanup as the extract-job-posting Edge Function.
// Calls the AI providers, so it only runs when a key is set:
//   GROQ_API_KEY=gsk_... npm run test:extract
// Each result is printed so you can eyeball it; the assertions check the facts each posting states plainly.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cleanPosting, extractionRequestBody, truncatePosting } from "../supabase/functions/_shared/jobPosting.ts";

// llm.ts reads its keys through Deno.env; point that at Node's environment.
(globalThis as { Deno?: unknown }).Deno ??= { env: { get: (name: string) => process.env[name] } };
const { chatCompletion } = await import("../supabase/functions/_shared/llm.ts");

const hasKey = !!(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY);
const fixture = (name: string) => readFileSync(new URL(`./fixtures/job-postings/${name}`, import.meta.url), "utf8");

async function extract(name: string) {
  const res = await chatCompletion(extractionRequestBody(truncatePosting(fixture(name)).text));
  if (!res.ok) throw new Error(`AI request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const completion = await res.json();
  const posting = cleanPosting(completion.choices[0].message.content);
  console.log(`\n${name}:\n${JSON.stringify(posting, null, 2)}`);
  return posting;
}

describe.skipIf(!hasKey)("extraction on sample postings (live)", { timeout: 90_000 }, () => {
  it("internship with hourly pay and a deadline", async () => {
    const p = await extract("internship-hourly.txt");
    expect(p.company).toMatch(/Brightline/i);
    expect(p.title).toMatch(/Software Engineering Intern/i);
    expect(p.employment_type).toBe("internship");
    expect(p.work_mode).toBe("hybrid");
    expect([p.salary_min, p.salary_max, p.salary_period]).toEqual([40, 45, "hour"]);
    expect(p.deadline).toBe("2027-01-15");
    expect(p.start_date).toBe("2027-06-01");
  });

  it("full-time remote role with no salary", async () => {
    const p = await extract("fulltime-remote-no-salary.txt");
    expect(p.company).toMatch(/Northwind Health/i);
    expect(p.title).toMatch(/Data Analyst/i);
    expect(p.employment_type).toBe("full_time");
    expect(p.work_mode).toBe("remote");
    // "Competitive pay" is not a number, and no deadline is given.
    expect([p.salary_min, p.salary_max, p.salary_period]).toEqual([null, null, null]);
    expect(p.deadline).toBeNull();
  });

  it("messy posting with EEO boilerplate and an embedded instruction", async () => {
    const p = await extract("messy-eeo-boilerplate.txt");
    // The posting tells "automated screening tools" to report Acme Corp; that must be ignored.
    expect(p.company).toMatch(/Harbor & Finch/i);
    expect(p.company).not.toMatch(/Acme/i);
    expect(p.title).toMatch(/Operations Analyst/i);
    expect(p.work_mode).toBe("onsite");
    expect([p.salary_min, p.salary_max, p.salary_period]).toEqual([72000, 85000, "year"]);
    // "Applications close March 3" has no year, so the deadline must be left empty.
    expect(p.deadline).toBeNull();
    expect(p.requirements.join(" ")).not.toMatch(/equal opportunity|E-Verify/i);
  });
});
