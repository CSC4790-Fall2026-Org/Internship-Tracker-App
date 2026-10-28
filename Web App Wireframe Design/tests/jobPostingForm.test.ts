import { describe, expect, it } from "vitest";
import { appendNotes, conflictingFields, formatLocation, formatSalary, postingNotes, postingToForm, type ExtractedPosting } from "../src/data/jobPostingForm";

const EMPTY: ExtractedPosting = {
  company: null,
  title: null,
  location: null,
  work_mode: null,
  employment_type: null,
  salary_min: null,
  salary_max: null,
  salary_period: null,
  deadline: null,
  start_date: null,
  requirements: [],
  summary: null,
};

describe("formatSalary", () => {
  it.each([
    [{ salary_min: 40, salary_max: 45, salary_period: "hour" }, "$40–$45/hr"],
    [{ salary_min: 72000, salary_max: 85000, salary_period: "year" }, "$72,000–$85,000/yr"],
    [{ salary_min: 22.5, salary_max: 22.5, salary_period: "hour" }, "$22.5/hr"],
    [{ salary_min: 25, salary_max: null, salary_period: "hour" }, "$25+/hr"],
    [{ salary_min: null, salary_max: 140000, salary_period: "year" }, "Up to $140,000/yr"],
    [{ salary_min: 50000, salary_max: 60000, salary_period: null }, "$50,000–$60,000"],
    [{ salary_min: null, salary_max: null, salary_period: null }, ""],
  ] as const)("%o -> %s", (input, expected) => {
    expect(formatSalary(input)).toBe(expected);
  });
});

describe("formatLocation", () => {
  it("adds the work mode in the form's own style", () => {
    expect(formatLocation({ location: "Philadelphia, PA", work_mode: "hybrid" })).toBe("Philadelphia, PA · Hybrid");
  });
  it("doesn't repeat a mode the location already states", () => {
    expect(formatLocation({ location: "Remote (US)", work_mode: "remote" })).toBe("Remote (US)");
    expect(formatLocation({ location: "Newark, NJ (on-site)", work_mode: "onsite" })).toBe("Newark, NJ (on-site)");
  });
  it("uses the mode alone when there's no location", () => {
    expect(formatLocation({ location: null, work_mode: "remote" })).toBe("Remote");
    expect(formatLocation({ location: null, work_mode: null })).toBe("");
  });
});

describe("postingToForm", () => {
  it("maps extracted fields onto the form and leaves unstated ones out", () => {
    const { fields } = postingToForm({ ...EMPTY, company: "Acme", title: "Data Intern", deadline: "2027-01-15" }, { text: "...", url: "" });
    expect(fields).toEqual({ company: "Acme", position: "Data Intern", deadline: "2027-01-15" });
  });

  it("uses the URL the user gave as the posting link", () => {
    expect(postingToForm({ ...EMPTY, company: "Acme" }, { text: "", url: " acme.com/jobs/1 " }).fields.jobUrl).toBe("acme.com/jobs/1");
  });
});

describe("postingNotes", () => {
  it("puts what the form has no field for, then the raw description, into notes", () => {
    const notes = postingNotes(
      { ...EMPTY, employment_type: "internship", work_mode: "hybrid", start_date: "2027-06-01", requirements: ["Python", "SQL"], summary: "Build dashboards." },
      "Full posting text",
    );
    expect(notes).toBe(
      [
        "Imported from job posting",
        "",
        "Summary: Build dashboards.",
        "",
        "Type: Internship\nWork mode: Hybrid\nStart date: 2027-06-01",
        "",
        "Requirements:\n- Python\n- SQL",
        "",
        "--- Job description ---\nFull posting text",
      ].join("\n"),
    );
  });

  it("is empty when there's nothing to add", () => {
    expect(postingNotes(EMPTY, "  ")).toBe("");
  });
});

describe("conflictingFields", () => {
  const current = { company: "Stripe", position: "", jobUrl: "", deadline: "", location: "NYC", salary: "" };
  it("flags only fields the user typed that the import would change", () => {
    expect(conflictingFields(current, { company: "Acme", position: "Intern", location: "NYC" })).toEqual(["company"]);
  });
});

describe("appendNotes", () => {
  it("keeps what the user wrote and adds the import below it", () => {
    expect(appendNotes("Referred by Sam", "Imported")).toBe("Referred by Sam\n\nImported");
    expect(appendNotes("", "Imported")).toBe("Imported");
    expect(appendNotes("Mine", "")).toBe("Mine");
  });
  it("doesn't add the same import twice", () => {
    expect(appendNotes("Mine\n\nImported", "Imported")).toBe("Mine\n\nImported");
  });
});
