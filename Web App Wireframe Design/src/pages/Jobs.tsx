import { useEffect, useMemo, useState, type ReactNode } from "react";
import { logoFor, useData } from "../data/DataContext";
import type { Application } from "../data/types";
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
import { STATUS } from "../data/status";
import { Badge, Banner, Button, buttonClass, Card, CompanyLogo, cx, EmptyState, Input, Page, PageHeader, Segmented, Select, Skeleton, Spinner, StatusDot } from "../components/ui";
import { useFeedback } from "../components/feedback";
import { IconAlertCircle, IconBriefcase, IconCheck, IconExternal, IconFile, IconMapPin, IconPlus, IconRefresh, IconSearch, IconSparkles, IconUndo, IconX } from "../components/icons";

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

const companyOf = (job: JobListing) => job.company || "Unknown company";

// timeAgo capitalizes "Just now" and "Yesterday" for standalone use; mid-sentence they read better lowercase.
function updatedLabel(value: string) {
  const ago = timeAgo(value);
  return ago === "Just now" || ago === "Yesterday" ? ago.toLowerCase() : ago;
}

export default function Jobs({ onNavigate }: { onNavigate: (screen: string, id?: string) => void }) {
  const { applications, addApplication, updateApplication } = useData();
  const { toast } = useFeedback();
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

  const setTab = (next: Tab) => {
    lastTab = next;
    setTabState(next);
  };

  const trackedByKey = useMemo(() => new Map(applications.map((a) => [roleKey(a.company, a.position), a])), [applications]);

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
    const plannedRole = recs && recs.jobType === jobType ? (recs.searches[0]?.what ?? "") : "";
    const what = jobType === "auto" || jobType === "internship" ? plannedRole || "intern" : plannedRole;
    const initial: JobSearch = { what, where: preferred, sort: "relevance", jobType };
    setForm(initial);
    runSearch(initial, 1);
  }, [tab, profile]);

  const track = async (job: JobListing, status: "wishlist" | "applied") => {
    setSavingId(job.id);
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
      toast(status === "applied" ? `Tracked ${companyOf(job)} as Applied` : `Saved ${companyOf(job)} to your Wishlist`);
      setApplyClicked((ids) => {
        const next = new Set(ids);
        next.delete(job.id);
        return next;
      });
    } catch (e) {
      toast(`Couldn't save to your tracker: ${(e as Error).message}`, { tone: "error" });
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
    <Page>
      <PageHeader
        title="Jobs"
        description="Find openings, apply, and track them without leaving Pipeline"
        actions={
          <Segmented
            label="Jobs view"
            value={tab}
            onChange={setTab}
            options={[
              { value: "recommended", label: "For you", icon: IconSparkles },
              { value: "browse", label: "Browse", icon: IconSearch },
            ]}
          />
        }
      />

      {tab === "recommended" ? (
        <RecommendedView profile={profile} recs={recs} generating={generating} error={recsError} onGenerate={generate} onJobTypeChange={changeJobType} onNavigate={onNavigate} cardProps={cardProps} />
      ) : (
        <div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(form, 1);
            }}
            className="mb-4 grid gap-2 rounded-card border border-line bg-surface p-2.5 sm:grid-cols-2 lg:grid-cols-[2fr_1.4fr_auto_auto_auto]"
          >
            <Input icon={IconSearch} aria-label="Title or keyword" value={form.what} onChange={(e) => setForm({ ...form, what: e.target.value })} placeholder="Title or keyword, e.g. data analyst intern" />
            <Input icon={IconMapPin} aria-label="Location" value={form.where} onChange={(e) => setForm({ ...form, where: e.target.value })} placeholder="City or state, blank for anywhere" />
            <Select aria-label="Sort" value={form.sort} onChange={(e) => setForm({ ...form, sort: e.target.value as JobSearch["sort"] })}>
              <option value="relevance">Most relevant</option>
              <option value="date">Newest</option>
            </Select>
            <Select aria-label="Job type" value={form.jobType} onChange={(e) => setForm({ ...form, jobType: e.target.value as JobType })}>
              {(Object.keys(JOB_TYPE_LABEL) as JobType[]).map((t) => (
                <option key={t} value={t}>
                  {JOB_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="primary" loading={searching} className="sm:col-span-2 lg:col-span-1">
              Search
            </Button>
          </form>

          {browseError && (
            <Banner icon={IconAlertCircle} className="mb-4">
              {browseError}
            </Banner>
          )}

          {browse && (
            <ListHeader>
              <span className="font-medium text-fg tabular-nums">{browse.total.toLocaleString()}</span> {browse.search.jobType !== "auto" && JOB_TYPE_LABEL[browse.search.jobType].toLowerCase() + " "}
              {browse.total === 1 ? "job" : "jobs"}
              {browse.search.what && <> for “{browse.search.what}”</>}
              {browse.search.where && <> near {browse.search.where}</>}
            </ListHeader>
          )}

          {!browse && searching ? (
            <JobGridSkeleton />
          ) : browse && browse.jobs.length === 0 ? (
            <Card>
              <EmptyState icon={IconSearch} title="No jobs match that search" description="Try fewer keywords, or leave the location blank to search everywhere." />
            </Card>
          ) : browse ? (
            <div className={cx("transition-opacity", searching && browse.page === 1 && "opacity-50")}>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {browse.jobs.map((job) => (
                  <JobCard key={job.id} {...cardProps(job)} />
                ))}
              </div>
              {browse.jobs.length < browse.total && browse.page < 50 && (
                <div className="mt-5 text-center">
                  <Button onClick={() => runSearch(browse.search, browse.page + 1)} loading={searching}>
                    Load more
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </Page>
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
  if (profile === undefined) return <JobGridSkeleton />;

  if (!profile) {
    return (
      <Card>
        <EmptyState
          icon={IconFile}
          title="Add your resume to get matches"
          description="We read your skills, experience and preferred locations, then pick listings that fit and explain why."
          actions={
            <Button variant="primary" onClick={() => onNavigate("ai-coach")}>
              Go to Profile
            </Button>
          }
        />
      </Card>
    );
  }

  const picker = <JobTypePicker value={profile.job_type} disabled={generating} onChange={onJobTypeChange} />;
  const errorBanner = error && (
    <Banner icon={IconAlertCircle} className="mb-4">
      {error}
    </Banner>
  );

  if (generating) {
    return (
      <>
        {picker}
        <Card className="mb-4 flex items-center gap-3 px-4 py-3">
          <Spinner className="text-accent" />
          <p className="text-ui text-fg-2">Reading your profile, searching listings and ranking the best fits. This can take up to 30 seconds.</p>
        </Card>
        <JobGridSkeleton />
      </>
    );
  }

  if (!recs) {
    return (
      <>
        {picker}
        {errorBanner}
        <Card>
          <EmptyState
            icon={IconSparkles}
            title="Find jobs that fit your resume"
            description="We search current listings based on your profile, then pick the best fits and explain each one."
            actions={
              <Button variant="primary" icon={IconSparkles} onClick={() => onGenerate()}>
                Find my matches
              </Button>
            }
          />
        </Card>
      </>
    );
  }

  return (
    <>
      {picker}
      {errorBanner}
      {/* Keyed so a new set of results resets any unsaved edits to the searches. */}
      <SearchEditor key={recs.generatedAt} saved={recs.searches} generatedAt={recs.generatedAt} onRun={onGenerate} />

      {recs.jobs.length === 0 ? (
        <Card>
          <EmptyState
            icon={IconBriefcase}
            title="No strong matches right now"
            description="New listings appear daily, so try refreshing later. Adding skills and preferred locations to your profile also helps."
            actions={<Button onClick={() => onNavigate("ai-coach")}>Edit profile</Button>}
          />
        </Card>
      ) : (
        <>
          <ListHeader>
            <span className="font-medium text-fg tabular-nums">{recs.jobs.length}</span> {recs.jobs.length === 1 ? "match" : "matches"} picked for you
          </ListHeader>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {recs.jobs.map((job) => (
              <JobCard key={job.id} {...cardProps(job)} recommendation={job} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

const sameSearchList = (a: SavedSearch[], b: SavedSearch[]) => a.length === b.length && a.every((s, i) => s.what === b[i].what && s.where === b[i].where);

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

  return (
    <Card className="mb-4 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-ui text-fg-muted">Searching</span>
        {draft.map((s, i) => (
          <span key={`${s.what}|${s.where}|${i}`} className="inline-flex h-6 items-center gap-1 rounded-full border border-line bg-subtle pr-1 pl-2.5 text-xs font-medium text-fg-2">
            {s.what}
            {s.where && <span className="font-normal text-fg-muted">· {s.where}</span>}
            <button type="button" onClick={() => setDraft(draft.filter((_, j) => j !== i))} aria-label={`Remove ${s.what}`} title="Remove this search" className="rounded-full p-0.5 text-fg-faint transition-colors hover:bg-muted-strong hover:text-fg">
              <IconX size={12} />
            </button>
          </span>
        ))}
        {!adding && draft.length < MAX_SEARCHES && (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-line-strong px-2.5 text-xs text-fg-muted transition-colors hover:border-fg-faint hover:text-fg">
            <IconPlus size={12} /> Add search
          </button>
        )}
        <span className="ml-auto text-xs text-fg-muted">Updated {updatedLabel(generatedAt)}</span>
        {changed ? (
          <>
            <Button size="sm" variant="ghost" icon={IconUndo} onClick={() => setDraft(saved)}>
              Undo
            </Button>
            <Button size="sm" variant="primary" onClick={() => onRun(draft)} disabled={draft.length === 0}>
              Search these
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" icon={IconSparkles} onClick={() => onRun()} title="Replace these with searches the AI picks from your resume">
              Suggest from resume
            </Button>
            <Button size="sm" icon={IconRefresh} onClick={() => onRun(saved)}>
              Refresh
            </Button>
          </>
        )}
      </div>

      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
          className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line pt-2.5"
        >
          <div className="min-w-48 flex-[2]">
            <Input autoFocus aria-label="Role or keyword" value={what} onChange={(e) => setWhat(e.target.value)} placeholder="Role or keyword, e.g. backend engineer" maxLength={80} className="h-7" />
          </div>
          <div className="min-w-36 flex-1">
            <Input aria-label="City or state" value={where} onChange={(e) => setWhere(e.target.value)} placeholder="City or state (optional)" maxLength={80} className="h-7" />
          </div>
          <Button size="sm" variant="primary" type="submit" disabled={!what.trim()}>
            Add
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </form>
      )}
    </Card>
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
    <div className={cx("mb-3 flex flex-wrap items-center gap-2", disabled && "pointer-events-none opacity-60")}>
      <span className="text-ui text-fg-muted">Looking for</span>
      <Segmented
        size="sm"
        label="Job type"
        value={value}
        onChange={onChange}
        options={(Object.keys(JOB_TYPE_LABEL) as JobType[]).map((t) => ({ value: t, label: t === "auto" ? "Auto" : JOB_TYPE_LABEL[t], title: JOB_TYPE_HINT[t] }))}
      />
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
  const meta = [job.location, job.contractTime === "full_time" ? "Full-time" : job.contractTime === "part_time" ? "Part-time" : "", job.created ? timeAgo(job.created) : ""].filter(Boolean);
  const showAppliedPrompt = askedAboutApplying && (!tracked || tracked.status === "wishlist");

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <CompanyLogo name={companyOf(job)} initials={logo.logo_initials} color={logo.logo_color} size={36} />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug font-semibold text-fg">{job.title}</p>
          <p className="mt-0.5 text-ui text-fg-2">{companyOf(job)}</p>
          <p className="mt-0.5 text-xs text-fg-muted">{meta.join(" · ")}</p>
          {salary && (
            <p className="mt-1 text-xs font-medium text-fg-2 tabular-nums">
              {salary}
              {job.salaryPredicted && (
                <a
                  href="https://www.adzuna.com/jobs/salary-predictor.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Salary estimate powered by Adzuna Jobsworth"
                  className="ml-1.5 font-normal text-fg-muted underline decoration-dotted underline-offset-2 hover:text-fg"
                >
                  Adzuna Jobsworth estimate
                </a>
              )}
            </p>
          )}
        </div>
        {recommendation && <MatchScore score={recommendation.score} />}
      </div>

      {recommendation ? (
        <div className="rounded-lg border border-accent/20 bg-accent-soft px-3 py-2.5">
          <p className="mb-1 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-accent-fg">
            <IconSparkles size={12} />
            AI insight
          </p>
          <p className="text-ui leading-relaxed text-fg">{recommendation.reason}</p>
          {recommendation.matchedSkills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {recommendation.matchedSkills.map((skill) => (
                <span key={skill} className="rounded-full border border-accent/20 bg-surface px-2 py-px text-2xs font-medium text-accent-fg">
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        job.description && <p className="line-clamp-3 text-ui leading-relaxed text-fg-muted">{job.description}</p>
      )}

      {showAppliedPrompt && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/20 bg-accent-soft px-3 py-2">
          <span className="mr-auto text-ui font-medium text-accent-fg">Did you apply?</span>
          <Button size="sm" variant="primary" onClick={() => onTrack("applied")} loading={saving}>
            {tracked ? "Mark as applied" : "Yes, track it"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismissApplied} disabled={saving}>
            Not yet
          </Button>
        </div>
      )}

      <div className="mt-auto flex items-center gap-2 pt-1">
        <a href={job.url} target="_blank" rel="noopener noreferrer" onClick={onApplyClicked} className={buttonClass("primary", "md")}>
          Apply
          <IconExternal size={14} />
        </a>
        {tracked ? (
          <button type="button" onClick={() => onOpenTracked(tracked.id)} title="Open in your tracker" className={buttonClass("secondary", "md")}>
            <IconCheck size={14} className="text-success" />
            Tracked
            <span className="flex items-center gap-1 text-fg-muted">
              · <StatusDot status={tracked.status} /> {STATUS[tracked.status].label}
            </span>
          </button>
        ) : (
          <Button icon={IconPlus} onClick={() => onTrack("wishlist")} loading={saving} title="Add to your Wishlist to apply later">
            Save for later
          </Button>
        )}
      </div>
    </Card>
  );
}

function MatchScore({ score }: { score: number }) {
  return (
    <span title="How well this role fits your profile, as judged by the AI" className="shrink-0">
      <Badge tone={score >= 80 ? "success" : score >= 60 ? "accent" : "neutral"}>{score}% match</Badge>
    </span>
  );
}

// ---------- Small pieces ----------

// Adzuna's terms require this label wherever their listings are shown.
function ListHeader({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-ui text-fg-muted">{children}</p>
      <p className="text-ui text-fg-muted">
        <a href="https://www.adzuna.com" target="_blank" rel="noopener noreferrer" className="font-medium text-accent-fg hover:underline">
          Jobs
        </a>{" "}
        by{" "}
        <a href="https://www.adzuna.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-fg hover:underline">
          Adzuna
        </a>
      </p>
    </div>
  );
}

function JobGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" role="status" aria-label="Loading jobs">
      {Array.from({ length: 4 }, (_, i) => (
        <Card key={i} className="space-y-3 p-4">
          <div className="flex gap-3">
            <Skeleton className="size-9 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-40" />
        </Card>
      ))}
    </div>
  );
}
