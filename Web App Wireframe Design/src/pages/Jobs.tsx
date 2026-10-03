import { useEffect, useMemo, useState } from "react";
import { logoFor, useData } from "../data/DataContext";
import type { Application, AppStatus } from "../data/types";
import { fetchResumeProfile, saveJobType, type ResumeProfile } from "../data/resume";
import {
  fetchRecommendations,
  formatSalary,
  generateRecommendations,
  JOB_TYPE_LABEL,
  MAX_SEARCHES,
  roleKey,
  searchJobs,
  type JobListing,
  type JobRecommendation,
  type JobSearch,
  type JobType,
  type Recommendations,
  type SavedSearch,
} from "../data/jobs";
import { timeAgo } from "../data/dates";

type Tab = "recommended" | "browse";

interface BrowseState {
  search: JobSearch;
  jobs: JobListing[];
  total: number;
  page: number;
}

// Kept outside the component so leaving the page and coming back doesn't re-run the search.
// Every search costs a call against the Adzuna quota that all users share.
let lastTab: Tab = "recommended";
let browseCache: BrowseState | null = null;

const STATUS_STYLE: Record<AppStatus, { label: string; color: string }> = {
  wishlist: { label: "Wishlist", color: "#64748B" },
  applied: { label: "Applied", color: "#2563EB" },
  interviewing: { label: "Interviewing", color: "#D97706" },
  offer: { label: "Offer", color: "#059669" },
  rejected: { label: "Closed", color: "#DC2626" },
};

const companyOf = (job: JobListing) => job.company || "Unknown company";

// timeAgo capitalizes "Just now" and "Yesterday" for standalone use; mid-sentence they read better lowercase.
function updatedLabel(value: string) {
  const ago = timeAgo(value);
  return ago === "Just now" || ago === "Yesterday" ? ago.toLowerCase() : ago;
}

export default function Jobs({ onNavigate }: { onNavigate: (screen: string, id?: string) => void }) {
  const { applications, addApplication, updateApplication } = useData();
  const [tab, setTabState] = useState<Tab>(lastTab);

  // undefined while loading, null when the user has no resume on file
  const [profile, setProfile] = useState<ResumeProfile | null | undefined>(undefined);
  const [recs, setRecs] = useState<Recommendations | null>(null);
  const [generating, setGenerating] = useState(false);
  const [recsError, setRecsError] = useState<string | null>(null);

  const [browse, setBrowse] = useState<BrowseState | null>(browseCache);
  const [form, setForm] = useState<JobSearch>(browseCache?.search ?? { what: "intern", where: "", sort: "relevance", jobType: "auto" });
  const [searching, setSearching] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);

  // Jobs whose "Apply" link was clicked, so we can ask whether they applied.
  const [applyClicked, setApplyClicked] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const setTab = (next: Tab) => {
    lastTab = next;
    setTabState(next);
  };

  const trackedByKey = useMemo(
    () => new Map(applications.map((a) => [roleKey(a.company, a.position), a])),
    [applications],
  );

  const generate = async (searches?: SavedSearch[]) => {
    setGenerating(true);
    setRecsError(null);
    try {
      setRecs(await generateRecommendations(searches));
    } catch (e) {
      setRecsError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  // Saved to the profile so recommendations and Browse both start from it next time.
  const changeJobType = async (jobType: JobType) => {
    if (!profile || profile.job_type === jobType) return;
    const previous = profile;
    setProfile({ ...profile, job_type: jobType });
    try {
      await saveJobType(profile.id, jobType);
    } catch (e) {
      setProfile(previous);
      setRecsError(`Couldn't save your preference: ${(e as Error).message}`);
      return;
    }
    generate();
  };

  useEffect(() => {
    Promise.all([fetchResumeProfile(), fetchRecommendations()])
      .then(([p, saved]) => {
        setProfile(p);
        setRecs(saved);
        // First visit with a resume on file: build the first set straight away.
        if (p && !saved) generate();
      })
      .catch((e: Error) => {
        setProfile(null);
        setRecsError(e.message);
      });
  }, []);

  const runSearch = async (search: JobSearch, page: number) => {
    setSearching(true);
    setBrowseError(null);
    try {
      const result = await searchJobs(search, page);
      const next: BrowseState = {
        search,
        page,
        total: result.total,
        // "Load more" appends; a new search replaces.
        jobs: page === 1 ? result.jobs : [...(browse?.jobs ?? []), ...result.jobs.filter((j) => !browse?.jobs.some((b) => b.id === j.id))],
      };
      browseCache = next;
      setBrowse(next);
    } catch (e) {
      setBrowseError((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  // Open Browse with the user's preferred job type near their first preferred location.
  useEffect(() => {
    if (tab !== "browse" || browse || searching || profile === undefined) return;
    const preferred = profile?.preferred_locations.find((l) => !/remote/i.test(l)) ?? "";
    const jobType = profile?.job_type ?? "auto";
    // Reuse a role the AI already planned for this job type, rather than a blank keyword that matches everything.
    const plannedRole = recs && recs.jobType === jobType ? recs.searches[0]?.what ?? "" : "";
    const what = jobType === "auto" || jobType === "internship" ? plannedRole || "intern" : plannedRole;
    const initial: JobSearch = { what, where: preferred, sort: "relevance", jobType };
    setForm(initial);
    runSearch(initial, 1);
  }, [tab, profile]);

  const track = async (job: JobListing, status: "wishlist" | "applied") => {
    setSavingId(job.id);
    setActionError(null);
    try {
      const existing = trackedByKey.get(roleKey(companyOf(job), job.title));
      if (existing) {
        await updateApplication(existing.id, { status });
      } else {
        await addApplication({
          company: companyOf(job),
          position: job.title,
          jobUrl: job.url,
          deadline: "",
          status,
          location: job.location,
          salary: formatSalary(job),
          notes: `Found on the Jobs page (via Adzuna).\n\n${job.description}`,
        });
      }
      setApplyClicked((ids) => {
        const next = new Set(ids);
        next.delete(job.id);
        return next;
      });
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  const cardProps = (job: JobListing) => ({
    job,
    tracked: trackedByKey.get(roleKey(companyOf(job), job.title)),
    askedAboutApplying: applyClicked.has(job.id),
    saving: savingId === job.id,
    onApplyClicked: () => setApplyClicked((ids) => new Set(ids).add(job.id)),
    onDismissApplied: () =>
      setApplyClicked((ids) => {
        const next = new Set(ids);
        next.delete(job.id);
        return next;
      }),
    onTrack: (status: "wishlist" | "applied") => track(job, status),
    onOpenTracked: (id: string) => onNavigate("detail", id),
  });

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "1.5rem", fontWeight: 700, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
            Jobs
          </h1>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--muted-foreground)", marginTop: "2px" }}>
            Find new roles, apply, and track them without leaving Pipeline
          </p>
        </div>
        <div style={{ display: "flex", background: "var(--muted)", border: "1px solid var(--border)", borderRadius: "9px", padding: "3px", gap: "2px" }}>
          {(["recommended", "browse"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                fontFamily: "var(--font-body)", fontSize: "0.8125rem", fontWeight: tab === t ? 600 : 450,
                color: tab === t ? "var(--foreground)" : "var(--muted-foreground)",
                background: tab === t ? "var(--card)" : "transparent",
                boxShadow: tab === t ? "0 1px 2px rgba(15, 23, 42, 0.08)" : "none",
                border: "none", borderRadius: "7px", padding: "6px 14px", cursor: "pointer",
              }}
            >
              {t === "recommended" ? "Recommended" : "Browse"}
            </button>
          ))}
        </div>
      </div>

      {actionError && <ErrorBanner text={`Couldn't save to your tracker: ${actionError}`} />}

      {tab === "recommended" ? (
        <RecommendedView
          profile={profile}
          recs={recs}
          generating={generating}
          error={recsError}
          onGenerate={generate}
          onJobTypeChange={changeJobType}
          onNavigate={onNavigate}
          cardProps={cardProps}
        />
      ) : (
        <div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(form, 1);
            }}
            style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "10px", padding: "10px 14px", marginBottom: "12px" }}
            className="flex flex-wrap items-center gap-2"
          >
            <SearchInput value={form.what} onChange={(v) => setForm({ ...form, what: v })} placeholder="Title or keyword, e.g. data analyst intern" icon="search" />
            <SearchInput value={form.where} onChange={(v) => setForm({ ...form, where: v })} placeholder="City or state, blank for anywhere" icon="pin" />
            <select
              value={form.sort}
              onChange={(e) => setForm({ ...form, sort: e.target.value as JobSearch["sort"] })}
              style={{ ...inputStyle, width: "auto", paddingLeft: "10px", cursor: "pointer" }}
            >
              <option value="relevance">Most relevant</option>
              <option value="date">Newest</option>
            </select>
            <select
              value={form.jobType}
              onChange={(e) => setForm({ ...form, jobType: e.target.value as JobType })}
              style={{ ...inputStyle, width: "auto", paddingLeft: "10px", cursor: "pointer" }}
            >
              {(Object.keys(JOB_TYPE_LABEL) as JobType[]).map((t) => (
                <option key={t} value={t}>{JOB_TYPE_LABEL[t]}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={searching}
              style={{ background: "var(--primary)", color: "white", border: "none", borderRadius: "7px", padding: "7px 16px", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.8125rem", cursor: searching ? "not-allowed" : "pointer", opacity: searching ? 0.6 : 1 }}
            >
              Search
            </button>
          </form>

          {browseError && <ErrorBanner text={browseError} />}

          {browse && (
            <ListHeader>
              {browse.total.toLocaleString()}{" "}
              {browse.search.jobType !== "auto" && JOB_TYPE_LABEL[browse.search.jobType].toLowerCase() + " "}
              {browse.total === 1 ? "job" : "jobs"}
              {browse.search.what && <> for “{browse.search.what}”</>}
              {browse.search.where && <> near {browse.search.where}</>}
            </ListHeader>
          )}

          {!browse && searching ? (
            <LoadingCard text="Searching jobs…" />
          ) : browse && browse.jobs.length === 0 ? (
            <Panel>
              <PanelTitle>No jobs match that search</PanelTitle>
              <PanelText>Try fewer keywords, or leave the location blank to search everywhere.</PanelText>
            </Panel>
          ) : browse ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {browse.jobs.map((job) => (
                  <JobCard key={job.id} {...cardProps(job)} />
                ))}
              </div>
              {browse.jobs.length < browse.total && browse.page < 50 && (
                <div style={{ textAlign: "center", marginTop: "16px" }}>
                  <button
                    onClick={() => runSearch(browse.search, browse.page + 1)}
                    disabled={searching}
                    style={{ ...secondaryButton, padding: "8px 20px", cursor: searching ? "not-allowed" : "pointer", opacity: searching ? 0.6 : 1 }}
                  >
                    {searching ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ---------- Recommended ----------

function RecommendedView({
  profile,
  recs,
  generating,
  error,
  onGenerate,
  onJobTypeChange,
  onNavigate,
  cardProps,
}: {
  profile: ResumeProfile | null | undefined;
  recs: Recommendations | null;
  generating: boolean;
  error: string | null;
  onGenerate: (searches?: SavedSearch[]) => void;
  onJobTypeChange: (jobType: JobType) => void;
  onNavigate: (screen: string, id?: string) => void;
  cardProps: (job: JobListing) => JobCardProps;
}) {
  if (profile === undefined) return <LoadingCard text="Loading…" />;

  if (!profile) {
    return (
      <Panel>
        <PanelIcon />
        <PanelTitle>Upload your resume to get recommendations</PanelTitle>
        <PanelText>We read your skills, experience and preferred locations, then pick listings that fit and explain why.</PanelText>
        <button onClick={() => onNavigate("ai-coach")} style={primaryButton}>
          Go to Profile
        </button>
      </Panel>
    );
  }

  const picker = <JobTypePicker value={profile.job_type} disabled={generating} onChange={onJobTypeChange} />;

  if (generating) {
    return (
      <>
        {picker}
        <LoadingCard text="Reading your profile, searching listings and ranking the best fits. This can take up to 30 seconds." />
      </>
    );
  }

  if (!recs) {
    return (
      <>
        {picker}
        {error && <ErrorBanner text={error} />}
        <Panel>
          <PanelIcon />
          <PanelTitle>Find jobs that fit your resume</PanelTitle>
          <PanelText>We search current listings based on your profile, then pick the best fits and explain each one.</PanelText>
          <button onClick={() => onGenerate()} style={primaryButton}>
            Find my matches
          </button>
        </Panel>
      </>
    );
  }

  return (
    <>
      {picker}
      {error && <ErrorBanner text={error} />}
      {/* Keyed so a new set of results resets any unsaved edits to the searches. */}
      <SearchEditor key={recs.generatedAt} saved={recs.searches} generatedAt={recs.generatedAt} onRun={onGenerate} />

      {recs.jobs.length === 0 ? (
        <Panel>
          <PanelTitle>No strong matches right now</PanelTitle>
          <PanelText>New listings appear daily, so try refreshing later. Adding skills and preferred locations to your profile also helps.</PanelText>
          <button onClick={() => onNavigate("ai-coach")} style={secondaryButton}>
            Edit profile
          </button>
        </Panel>
      ) : (
        <>
          <ListHeader>
            {recs.jobs.length} {recs.jobs.length === 1 ? "match" : "matches"} picked for you
          </ListHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {recs.jobs.map((job) => (
              <JobCard key={job.id} {...cardProps(job)} recommendation={job} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

const sameSearchList = (a: SavedSearch[], b: SavedSearch[]) =>
  a.length === b.length && a.every((s, i) => s.what === b[i].what && s.where === b[i].where);

// The searches behind the current recommendations. Users can remove them or add their own, then re-run;
// the AI still ranks whatever those searches return against the resume.
function SearchEditor({ saved, generatedAt, onRun }: { saved: SavedSearch[]; generatedAt: string; onRun: (searches?: SavedSearch[]) => void }) {
  const [draft, setDraft] = useState<SavedSearch[]>(saved);
  const [adding, setAdding] = useState(false);
  const [what, setWhat] = useState("");
  const [where, setWhere] = useState("");
  const changed = !sameSearchList(draft, saved);

  const add = () => {
    if (!what.trim()) return;
    setDraft([...draft, { what: what.trim(), where: where.trim() }]);
    setWhat("");
    setWhere("");
    setAdding(false);
  };

  const smallInput: React.CSSProperties = { ...inputStyle, paddingLeft: "10px", paddingTop: "4px", paddingBottom: "4px", fontSize: "0.75rem" };

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "10px", padding: "10px 14px", marginBottom: "12px" }}>
      <div className="flex flex-wrap items-center gap-2">
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--muted-foreground)" }}>Searching</span>
        {draft.map((s, i) => (
          <span
            key={`${s.what}|${s.where}|${i}`}
            style={{ background: "var(--accent)", color: "var(--accent-foreground)", borderRadius: "100px", padding: "2px 4px 2px 10px", fontFamily: "var(--font-body)", fontSize: "0.75rem", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "4px" }}
          >
            {s.what}
            {s.where && <span style={{ opacity: 0.7 }}> · {s.where}</span>}
            <button
              onClick={() => setDraft(draft.filter((_, j) => j !== i))}
              title="Remove this search"
              aria-label={`Remove ${s.what}`}
              style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", opacity: 0.6, padding: "0 4px", fontSize: "0.875rem", lineHeight: 1 }}
            >
              ×
            </button>
          </span>
        ))}
        {!adding && draft.length < MAX_SEARCHES && (
          <button
            onClick={() => setAdding(true)}
            style={{ background: "none", border: "1px dashed var(--border)", borderRadius: "100px", padding: "2px 10px", fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--muted-foreground)", cursor: "pointer" }}
          >
            + Add search
          </button>
        )}
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--muted-foreground)", marginLeft: "auto" }}>
          Updated {updatedLabel(generatedAt)}
        </span>
        {changed ? (
          <>
            <button onClick={() => setDraft(saved)} style={secondaryButton}>
              Undo
            </button>
            <button onClick={() => onRun(draft)} disabled={draft.length === 0} style={{ ...primaryButton, opacity: draft.length === 0 ? 0.6 : 1 }}>
              Search these
            </button>
          </>
        ) : (
          <>
            <button onClick={() => onRun()} title="Replace these with searches the AI picks from your resume" style={secondaryButton}>
              Suggest from resume
            </button>
            <button onClick={() => onRun(saved)} style={secondaryButton}>
              Refresh
            </button>
          </>
        )}
      </div>

      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex flex-wrap items-center gap-2"
          style={{ marginTop: "10px" }}
        >
          <div style={{ flex: "2 1 200px" }}>
            <input autoFocus value={what} onChange={(e) => setWhat(e.target.value)} placeholder="Role or keyword, e.g. backend engineer" style={smallInput} maxLength={80} />
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <input value={where} onChange={(e) => setWhere(e.target.value)} placeholder="City or state (optional)" style={smallInput} maxLength={80} />
          </div>
          <button type="submit" disabled={!what.trim()} style={{ ...primaryButton, padding: "5px 12px", fontSize: "0.75rem", opacity: what.trim() ? 1 : 0.6 }}>
            Add
          </button>
          <button type="button" onClick={() => setAdding(false)} style={{ ...secondaryButton, padding: "4px 10px", fontSize: "0.75rem" }}>
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}

const JOB_TYPE_HINT: Record<JobType, string> = {
  auto: "Picks internships or full-time roles based on your graduation date",
  internship: "Internships and co-ops",
  new_grad: "Full-time entry-level roles, no internships or senior roles",
  full_time: "Full-time roles, no internships",
  part_time: "Part-time roles",
};

function JobTypePicker({ value, disabled, onChange }: { value: JobType; disabled: boolean; onChange: (jobType: JobType) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: "12px" }}>
      <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--muted-foreground)" }}>Looking for</span>
      <div style={{ display: "flex", flexWrap: "wrap", background: "var(--muted)", border: "1px solid var(--border)", borderRadius: "9px", padding: "3px", gap: "2px" }}>
        {(Object.keys(JOB_TYPE_LABEL) as JobType[]).map((t) => (
          <button
            key={t}
            onClick={() => onChange(t)}
            disabled={disabled}
            title={JOB_TYPE_HINT[t]}
            style={{
              fontFamily: "var(--font-body)", fontSize: "0.75rem", fontWeight: value === t ? 600 : 450,
              color: value === t ? "var(--foreground)" : "var(--muted-foreground)",
              background: value === t ? "var(--card)" : "transparent",
              boxShadow: value === t ? "0 1px 2px rgba(15, 23, 42, 0.08)" : "none",
              border: "none", borderRadius: "7px", padding: "4px 11px",
              cursor: disabled ? "not-allowed" : "pointer", opacity: disabled && value !== t ? 0.6 : 1,
            }}
          >
            {t === "auto" ? "Auto" : JOB_TYPE_LABEL[t]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Job card ----------

interface JobCardProps {
  job: JobListing;
  recommendation?: JobRecommendation;
  tracked: Application | undefined;
  askedAboutApplying: boolean;
  saving: boolean;
  onApplyClicked: () => void;
  onDismissApplied: () => void;
  onTrack: (status: "wishlist" | "applied") => void;
  onOpenTracked: (id: string) => void;
}

function JobCard({ job, recommendation, tracked, askedAboutApplying, saving, onApplyClicked, onDismissApplied, onTrack, onOpenTracked }: JobCardProps) {
  const logo = logoFor(companyOf(job));
  const salary = formatSalary(job);
  const meta = [
    companyOf(job),
    job.location,
    job.contractTime === "full_time" ? "Full-time" : job.contractTime === "part_time" ? "Part-time" : "",
    job.created ? timeAgo(job.created) : "",
  ].filter(Boolean);
  const showAppliedPrompt = askedAboutApplying && (!tracked || tracked.status === "wishlist");

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
        <div
          style={{
            width: "36px", height: "36px", borderRadius: "9px", flexShrink: 0, background: logo.logo_color,
            color: "white", display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "0.75rem",
          }}
        >
          {logo.logo_initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.9375rem", color: "var(--foreground)", lineHeight: 1.3 }}>
            {job.title}
          </p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--muted-foreground)", marginTop: "2px" }}>
            {meta.join(" · ")}
          </p>
          {salary && (
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--foreground)", fontWeight: 500, marginTop: "2px" }}>
              {salary}
              {job.salaryPredicted && (
                <a
                  href="https://www.adzuna.com/jobs/salary-predictor.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Salary estimate powered by Adzuna Jobsworth"
                  style={{ color: "var(--muted-foreground)", fontWeight: 400, fontSize: "0.75rem", marginLeft: "6px", textDecoration: "underline dotted" }}
                >
                  Adzuna Jobsworth estimate
                </a>
              )}
            </p>
          )}
        </div>
        {recommendation && <MatchPill score={recommendation.score} />}
      </div>

      {recommendation ? (
        <div style={{ background: "var(--accent)", borderRadius: "8px", padding: "10px 12px" }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--accent-foreground)", lineHeight: 1.5 }}>
            {recommendation.reason}
          </p>
          {recommendation.matchedSkills.length > 0 && (
            <div className="flex flex-wrap gap-1" style={{ marginTop: "8px" }}>
              {recommendation.matchedSkills.map((skill) => (
                <span
                  key={skill}
                  style={{ background: "var(--card)", color: "var(--accent-foreground)", borderRadius: "100px", padding: "1px 8px", fontFamily: "var(--font-body)", fontSize: "0.6875rem", fontWeight: 500 }}
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        job.description && (
          <p
            style={{
              fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--muted-foreground)", lineHeight: 1.55,
              display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}
          >
            {job.description}
          </p>
        )
      )}

      {showAppliedPrompt && (
        <div
          style={{ background: "var(--muted)", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px 12px" }}
          className="flex flex-wrap items-center gap-2"
        >
          <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--foreground)", marginRight: "auto" }}>
            Did you apply?
          </span>
          <button onClick={() => onTrack("applied")} disabled={saving} style={{ ...primaryButton, padding: "5px 12px", fontSize: "0.75rem", opacity: saving ? 0.6 : 1 }}>
            {tracked ? "Mark as applied" : "Yes, track it"}
          </button>
          <button onClick={onDismissApplied} disabled={saving} style={{ ...secondaryButton, padding: "5px 12px", fontSize: "0.75rem" }}>
            Not yet
          </button>
        </div>
      )}

      <div className="flex items-center gap-2" style={{ marginTop: "auto" }}>
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onApplyClicked}
          style={{ ...primaryButton, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "0.88")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "1")}
        >
          Apply
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M3 1.5h5.5V7M8.5 1.5L1.5 8.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        {tracked ? (
          <button
            onClick={() => onOpenTracked(tracked.id)}
            title="Open in your tracker"
            style={{
              ...secondaryButton, display: "inline-flex", alignItems: "center", gap: "6px",
              color: STATUS_STYLE[tracked.status].color, borderColor: STATUS_STYLE[tracked.status].color + "44",
              background: STATUS_STYLE[tracked.status].color + "12",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M2 5.5l2.5 2.5L9 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Tracked · {STATUS_STYLE[tracked.status].label}
          </button>
        ) : (
          <button
            onClick={() => onTrack("wishlist")}
            disabled={saving}
            title="Add to your Wishlist to apply later"
            style={{ ...secondaryButton, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "Saving…" : "Save for later"}
          </button>
        )}
      </div>
    </div>
  );
}

function MatchPill({ score }: { score: number }) {
  const color = score >= 80 ? "#059669" : score >= 60 ? "#2563EB" : "#64748B";
  return (
    <span
      title="How well this role fits your profile, as judged by the AI"
      style={{
        flexShrink: 0, background: color + "18", color, border: `1px solid ${color}44`, borderRadius: "100px",
        padding: "2px 9px", fontFamily: "var(--font-body)", fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap",
      }}
    >
      {score}% match
    </span>
  );
}

// ---------- Small pieces ----------

// Adzuna's terms require this label wherever their listings are shown.
function ListHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between" style={{ marginBottom: "10px" }}>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--muted-foreground)" }}>{children}</p>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--muted-foreground)" }}>
        <a href="https://www.adzuna.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}>
          Jobs
        </a>{" "}
        by{" "}
        <a href="https://www.adzuna.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--foreground)", fontWeight: 700, textDecoration: "none", fontFamily: "var(--font-heading)" }}>
          Adzuna
        </a>
      </p>
    </div>
  );
}

function SearchInput({ value, onChange, placeholder, icon }: { value: string; onChange: (v: string) => void; placeholder: string; icon: "search" | "pin" }) {
  return (
    <div style={{ position: "relative", flex: "1 1 220px" }}>
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)", pointerEvents: "none" }}>
        {icon === "search" ? (
          <>
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4" />
            <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="M6.5 12s4-3.6 4-6.8a4 4 0 1 0-8 0C2.5 8.4 6.5 12 6.5 12z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            <circle cx="6.5" cy="5.2" r="1.4" stroke="currentColor" strokeWidth="1.3" />
          </>
        )}
      </svg>
      <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </div>
  );
}

function ErrorBanner({ text }: { text: string }) {
  return (
    <p role="alert" style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "#B91C1C", background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: "8px", padding: "8px 12px", marginBottom: "12px" }}>
      {text}
    </p>
  );
}

function LoadingCard({ text }: { text: string }) {
  return (
    <Panel>
      <svg className="animate-spin" width="22" height="22" viewBox="0 0 22 22" fill="none" style={{ margin: "0 auto 12px", display: "block" }}>
        <circle cx="11" cy="11" r="9" stroke="var(--border)" strokeWidth="2.5" />
        <path d="M20 11a9 9 0 0 0-9-9" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <PanelText>{text}</PanelText>
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "48px 24px", textAlign: "center" }}>
      {children}
    </div>
  );
}

function PanelIcon() {
  return (
    <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2.5" y="6" width="15" height="10.5" rx="2" stroke="var(--primary)" strokeWidth="1.5" />
        <path d="M7 6V4.5A1.5 1.5 0 0 1 8.5 3h3A1.5 1.5 0 0 1 13 4.5V6M2.5 10.5h15" stroke="var(--primary)" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.9375rem", color: "var(--foreground)", marginBottom: "4px" }}>
      {children}
    </p>
  );
}

function PanelText({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--muted-foreground)", marginBottom: "16px", maxWidth: "440px", marginLeft: "auto", marginRight: "auto" }}>
      {children}
    </p>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", paddingLeft: "30px", paddingRight: "10px", paddingTop: "7px", paddingBottom: "7px",
  fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--foreground)",
  background: "var(--muted)", border: "1px solid var(--border)", borderRadius: "7px",
  outline: "none", boxSizing: "border-box",
};

const primaryButton: React.CSSProperties = {
  background: "var(--primary)", color: "white", border: "none", borderRadius: "8px", padding: "8px 14px",
  fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: "8px",
  padding: "7px 12px", fontFamily: "var(--font-body)", fontWeight: 500, fontSize: "0.8125rem", cursor: "pointer",
};
