import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { SymbolView } from "expo-symbols";
import { useData } from "@shared/data/DataContext";
import { canMatchJobs, fetchOrCreateProfile, hasResume, saveJobType, type ResumeProfile } from "@shared/data/resume";
import {
  fetchRecommendations,
  formatSalary,
  generateRecommendations,
  JOB_TYPE_LABEL,
  MAX_SEARCHES,
  roleKey,
  searchJobs,
  type JobListing,
  type JobSearch,
  type JobType,
  type Recommendations,
  type SavedSearch,
} from "@shared/data/jobs";
import { timeAgo } from "@shared/data/dates";
import { AppText, Banner, Button, Card, Chip, EmptyState, Input, Screen, Segmented } from "@/components/ui";
import { companyOf, JobCard, type JobCardProps } from "@/components/job-card";
import { HeaderButton } from "@/components/header-button";
import { chooseAction, errorMessage, useToast } from "@/components/feedback";
import { useTheme } from "@/theme/use-theme";

type Tab = "recommended" | "browse";

interface BrowseState {
  search: JobSearch;
  jobs: JobListing[];
  total: number;
  page: number;
}

// Kept outside the component so leaving the tab and coming back doesn't re-run the search.
// Every search costs a call against the Adzuna quota that all users share.
let lastTab: Tab = "recommended";
let browseCache: BrowseState | null = null;

// timeAgo capitalizes "Just now" and "Yesterday" for standalone use; mid-sentence they read better lowercase.
function updatedLabel(value: string) {
  const ago = timeAgo(value);
  return ago === "Just now" || ago === "Yesterday" ? ago.toLowerCase() : ago;
}

/** Browse starts with the preferred job type near the first preferred location, reusing a role the AI already planned. */
function initialSearch(profile: ResumeProfile | null, recs: Recommendations | null): JobSearch {
  const where = profile?.preferred_locations.find((l) => !/remote/i.test(l)) ?? "";
  const jobType = profile?.job_type ?? "auto";
  const plannedRole = recs && recs.jobType === jobType ? (recs.searches[0]?.what ?? "") : "";
  const what = jobType === "auto" || jobType === "internship" ? plannedRole || "intern" : plannedRole;
  return { what, where, sort: "relevance", jobType };
}

/** The website's Jobs page: AI-picked matches from your profile, or browse live Adzuna listings, and track either. */
export default function Jobs() {
  const { applications, addApplication, updateApplication } = useData();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTabState] = useState<Tab>(lastTab);

  // undefined while loading, null when it couldn't be loaded
  const [profile, setProfile] = useState<ResumeProfile | null | undefined>(undefined);
  const [recs, setRecs] = useState<Recommendations | null>(null);
  const [generating, setGenerating] = useState(false);
  const [recsError, setRecsError] = useState<string | null>(null);

  const [browse, setBrowse] = useState<BrowseState | null>(browseCache);
  const [form, setForm] = useState<JobSearch>(browseCache?.search ?? { what: "intern", where: "", sort: "relevance", jobType: "auto" });
  const [searching, setSearching] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);

  // Jobs whose Apply was tapped, so the card can ask whether they applied.
  const [applyClicked, setApplyClicked] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

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
        jobs: page === 1 ? result.jobs : [...(browseCache?.jobs ?? []), ...result.jobs.filter((j) => !browseCache?.jobs.some((b) => b.id === j.id))],
      };
      browseCache = next;
      setBrowse(next);
    } catch (e) {
      setBrowseError((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const startBrowse = (p: ResumeProfile | null, r: Recommendations | null) => {
    const initial = initialSearch(p, r);
    setForm(initial);
    runSearch(initial, 1);
  };

  const setTab = (next: Tab) => {
    lastTab = next;
    setTabState(next);
    if (next === "browse" && !browse && !searching && profile !== undefined) startBrowse(profile, recs);
  };

  useEffect(() => {
    Promise.all([fetchOrCreateProfile(), fetchRecommendations()])
      .then(([p, saved]) => {
        setProfile(p);
        setRecs(saved);
        // First visit: build the first set straight away, from the resume or else the onboarding answers.
        if (canMatchJobs(p) && !saved) generate();
        if (lastTab === "browse" && !browseCache) startBrowse(p, saved);
      })
      .catch((e: Error) => {
        setProfile(null);
        setRecsError(e.message);
        if (lastTab === "browse" && !browseCache) startBrowse(null, null);
      });
    // Load once per visit to the tab, like the website's page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      toast(`Couldn't save to your tracker: ${errorMessage(e)}`, { tone: "error" });
    } finally {
      setSavingId(null);
    }
  };

  const cardProps = (job: JobListing): JobCardProps => ({
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
    onTrack: (status) => track(job, status),
    onOpenTracked: (id) => router.push({ pathname: "/applications/[id]", params: { id } }),
  });

  const openProfile = () => router.push("/more/profile");

  return (
    <Screen>
      <Stack.Screen options={{ headerRight: () => <HeaderButton icon="magnifyingglass" label="Search" onPress={() => router.push("/search")} /> }} />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "recommended", label: "For you" },
          { value: "browse", label: "Browse" },
        ]}
      />

      {tab === "recommended" ? (
        <RecommendedView profile={profile} recs={recs} generating={generating} error={recsError} onGenerate={generate} onJobTypeChange={changeJobType} onOpenProfile={openProfile} cardProps={cardProps} />
      ) : (
        <>
          <Card>
            <Input accessibilityLabel="Title or keyword" value={form.what} onChangeText={(what) => setForm({ ...form, what })} placeholder="Title or keyword, e.g. data analyst intern" returnKeyType="search" onSubmitEditing={() => runSearch(form, 1)} />
            <Input accessibilityLabel="Location" value={form.where} onChangeText={(where) => setForm({ ...form, where })} placeholder="City or state, blank for anywhere" returnKeyType="search" onSubmitEditing={() => runSearch(form, 1)} />
            <View style={styles.row}>
              <Chip label="Most relevant" active={form.sort === "relevance"} onPress={() => setForm({ ...form, sort: "relevance" })} />
              <Chip label="Newest" active={form.sort === "date"} onPress={() => setForm({ ...form, sort: "date" })} />
              <View style={styles.grow} />
              <JobTypeField value={form.jobType} onChange={(jobType) => setForm({ ...form, jobType })} />
            </View>
            <Button variant="primary" onPress={() => runSearch(form, 1)} loading={searching}>
              Search
            </Button>
          </Card>

          {browseError && <Banner>{browseError}</Banner>}

          {!browse && !browseError ? (
            <Loading />
          ) : browse ? (
            <>
              <ListHeader>
                {`${browse.total.toLocaleString()} ${browse.search.jobType !== "auto" ? `${JOB_TYPE_LABEL[browse.search.jobType].toLowerCase()} ` : ""}${browse.total === 1 ? "job" : "jobs"}${browse.search.what ? ` for “${browse.search.what}”` : ""}${browse.search.where ? ` near ${browse.search.where}` : ""}`}
              </ListHeader>
              {browse.jobs.length === 0 ? (
                <Card>
                  <EmptyState icon="magnifyingglass" title="No jobs match that search" description="Try fewer keywords, or leave the location blank to search everywhere." />
                </Card>
              ) : (
                <View style={[styles.cards, searching && browse.page === 1 && styles.dim]}>
                  {browse.jobs.map((job) => (
                    <JobCard key={job.id} {...cardProps(job)} />
                  ))}
                  {browse.jobs.length < browse.total && browse.page < 50 && (
                    <Button onPress={() => runSearch(browse.search, browse.page + 1)} loading={searching}>
                      Load more
                    </Button>
                  )}
                </View>
              )}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

// ---------- For you ----------

function RecommendedView({
  profile,
  recs,
  generating,
  error,
  onGenerate,
  onJobTypeChange,
  onOpenProfile,
  cardProps,
}: {
  profile: ResumeProfile | null | undefined;
  recs: Recommendations | null;
  generating: boolean;
  error: string | null;
  onGenerate: (searches?: SavedSearch[]) => void;
  onJobTypeChange: (jobType: JobType) => void;
  onOpenProfile: () => void;
  cardProps: (job: JobListing) => JobCardProps;
}) {
  const { colors } = useTheme();
  if (profile === undefined) return <Loading />;

  if (!profile || !canMatchJobs(profile)) {
    return (
      <Card>
        {profile === null && error && <Banner>{error}</Banner>}
        <EmptyState icon="doc" title="Add your resume or field to get matches" description="Upload your resume, or pick the field you work in on Profile. We'll search current listings and pick the ones that fit.">
          <Button variant="primary" onPress={onOpenProfile} style={styles.topGap}>
            Go to Profile
          </Button>
        </EmptyState>
      </Card>
    );
  }

  const picker = <JobTypeChips value={profile.job_type} disabled={generating} onChange={onJobTypeChange} />;
  const errorBanner = error && <Banner>{error}</Banner>;
  const resumeBanner = !hasResume(profile) && (
    <Banner tone="info" action={<Button onPress={onOpenProfile}>Add resume</Button>}>
      Matches are based on what you told us when you signed up. Add your resume to match on your skills and experience too.
    </Banner>
  );

  if (generating) {
    return (
      <>
        {picker}
        <Card style={styles.generating}>
          <ActivityIndicator color={colors.accent} />
          <AppText style={[styles.grow, { color: colors.fg2 }]}>Reading your profile, searching listings and ranking the best fits. This can take up to 30 seconds.</AppText>
        </Card>
      </>
    );
  }

  if (!recs) {
    return (
      <>
        {picker}
        {errorBanner}
        {resumeBanner}
        <Card>
          <EmptyState icon="sparkles" title={hasResume(profile) ? "Find jobs that fit your resume" : "Find jobs that fit you"} description="We search current listings based on your profile, then pick the best fits and explain each one.">
            <Button variant="primary" onPress={() => onGenerate()} style={styles.topGap}>
              Find my matches
            </Button>
          </EmptyState>
        </Card>
      </>
    );
  }

  return (
    <>
      {picker}
      {errorBanner}
      {resumeBanner}
      {/* Keyed so a new set of results resets any unsaved edits to the searches. */}
      <SearchEditor key={recs.generatedAt} saved={recs.searches} generatedAt={recs.generatedAt} onRun={onGenerate} />
      {recs.jobs.length === 0 ? (
        <Card>
          <EmptyState icon="briefcase" title="No strong matches right now" description="New listings appear daily, so try refreshing later. Adding skills and preferred locations to your profile also helps.">
            <Button onPress={onOpenProfile} style={styles.topGap}>
              Edit profile
            </Button>
          </EmptyState>
        </Card>
      ) : (
        <>
          <ListHeader>{`${recs.jobs.length} ${recs.jobs.length === 1 ? "match" : "matches"} picked for you`}</ListHeader>
          <View style={styles.cards}>
            {recs.jobs.map((job) => (
              <JobCard key={job.id} {...cardProps(job)} recommendation={job} />
            ))}
          </View>
        </>
      )}
    </>
  );
}

const sameSearchList = (a: SavedSearch[], b: SavedSearch[]) => a.length === b.length && a.every((s, i) => s.what === b[i].what && s.where === b[i].where);

// The searches behind the current recommendations. Remove them or add your own, then re-run; the AI still ranks
// whatever those searches return against the profile.
function SearchEditor({ saved, generatedAt, onRun }: { saved: SavedSearch[]; generatedAt: string; onRun: (searches?: SavedSearch[]) => void }) {
  const { colors } = useTheme();
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
    <Card>
      <View style={styles.searchTop}>
        <AppText variant="muted">Searching</AppText>
        <AppText variant="small">{`Updated ${updatedLabel(generatedAt)}`}</AppText>
      </View>
      <View style={styles.searchChips}>
        {draft.map((s, i) => (
          <View key={`${s.what}|${s.where}|${i}`} style={[styles.searchChip, { borderColor: colors.line, backgroundColor: colors.subtle }]}>
            <AppText style={[styles.searchChipText, { color: colors.fg2 }]}>
              {s.what}
              {s.where ? <AppText variant="small">{` · ${s.where}`}</AppText> : null}
            </AppText>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${s.what}`} onPress={() => setDraft(draft.filter((_, j) => j !== i))} hitSlop={8}>
              <SymbolView name="xmark" size={10} weight="semibold" tintColor={colors.fgMuted} />
            </Pressable>
          </View>
        ))}
        {!adding && draft.length < MAX_SEARCHES && (
          <Pressable accessibilityRole="button" onPress={() => setAdding(true)} style={[styles.searchChip, styles.addChip, { borderColor: colors.lineStrong }]}>
            <SymbolView name="plus" size={11} tintColor={colors.fgMuted} />
            <AppText variant="small">Add search</AppText>
          </Pressable>
        )}
      </View>
      {adding && (
        <View style={[styles.addForm, { borderTopColor: colors.line }]}>
          <Input autoFocus accessibilityLabel="Role or keyword" value={what} onChangeText={setWhat} placeholder="Role or keyword, e.g. backend engineer" maxLength={80} />
          <Input accessibilityLabel="City or state" value={where} onChangeText={setWhere} placeholder="City or state (optional)" maxLength={80} returnKeyType="done" onSubmitEditing={add} />
          <View style={styles.formActions}>
            <Button variant="ghost" onPress={() => setAdding(false)}>
              Cancel
            </Button>
            <Button variant="primary" onPress={add} disabled={!what.trim()}>
              Add
            </Button>
          </View>
        </View>
      )}
      <View style={styles.formActions}>
        {changed ? (
          <>
            <Button variant="ghost" onPress={() => setDraft(saved)}>
              Undo
            </Button>
            <Button variant="primary" onPress={() => onRun(draft)} disabled={draft.length === 0}>
              Search these
            </Button>
          </>
        ) : (
          <>
            <Button onPress={() => onRun()} accessibilityHint="Replaces these with searches the AI picks from your profile">
              Suggest searches
            </Button>
            <Button onPress={() => onRun(saved)}>Refresh</Button>
          </>
        )}
      </View>
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

const JOB_TYPES = Object.keys(JOB_TYPE_LABEL) as JobType[];

/** "Looking for" on For you: saved to the profile, then the matches re-run. */
function JobTypeChips({ value, disabled, onChange }: { value: JobType; disabled: boolean; onChange: (jobType: JobType) => void }) {
  return (
    <View style={disabled && styles.dim}>
      <AppText variant="small" style={styles.chipsLabel}>
        {`Looking for · ${JOB_TYPE_HINT[value]}`}
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {JOB_TYPES.map((t) => (
          <Chip key={t} label={t === "auto" ? "Auto" : JOB_TYPE_LABEL[t]} active={value === t} disabled={disabled} onPress={() => onChange(t)} />
        ))}
      </ScrollView>
    </View>
  );
}

/** Job type for a Browse search: a menu, since the row is shared with the sort chips. */
function JobTypeField({ value, onChange }: { value: JobType; onChange: (jobType: JobType) => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Job type: ${JOB_TYPE_LABEL[value]}. Change`}
      onPress={() => chooseAction("Job type", JOB_TYPES.map((t) => ({ label: JOB_TYPE_LABEL[t], onPress: () => onChange(t) })))}
      style={[styles.typeField, { borderColor: colors.line, backgroundColor: colors.surface }]}
    >
      <AppText>{JOB_TYPE_LABEL[value]}</AppText>
      <SymbolView name="chevron.up.chevron.down" size={11} tintColor={colors.fgMuted} />
    </Pressable>
  );
}

// Adzuna's terms require this credit wherever their listings are shown.
function ListHeader({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.listHeader}>
      <AppText variant="muted" style={styles.grow}>
        {children}
      </AppText>
      <AppText variant="muted" onPress={() => WebBrowser.openBrowserAsync("https://www.adzuna.com")} accessibilityRole="link">
        <AppText style={{ color: colors.accentFg, fontWeight: "500" }}>Jobs</AppText> by <AppText style={{ color: colors.fg, fontWeight: "600" }}>Adzuna</AppText>
      </AppText>
    </View>
  );
}

function Loading() {
  return (
    <View style={styles.loading} accessibilityLabel="Loading jobs">
      <ActivityIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  topGap: { marginTop: 8 },
  dim: { opacity: 0.5 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  cards: { gap: 12 },
  loading: { paddingVertical: 48, alignItems: "center" },
  generating: { flexDirection: "row", alignItems: "center", gap: 12 },
  searchTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  searchChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  searchChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderCurve: "continuous", borderRadius: 999, paddingLeft: 10, paddingRight: 8, paddingVertical: 5, maxWidth: "100%" },
  searchChipText: { fontSize: 13, fontWeight: "500", flexShrink: 1 },
  addChip: { borderStyle: "dashed", paddingLeft: 8 },
  addForm: { gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  formActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  chipsLabel: { marginBottom: 8 },
  chips: { gap: 8, paddingRight: 16 },
  typeField: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, borderWidth: 1, borderCurve: "continuous", borderRadius: 999, paddingHorizontal: 12 },
  listHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: -4 },
});
