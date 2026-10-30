import { useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { SymbolView, type SFSymbol } from "expo-symbols";
import type { AppStatus } from "@shared/data/types";
import { useData, type ActivityItem } from "@shared/data/DataContext";
import { addDaysISO, daysUntil, formatDate, formatTime, relativeDay, toDate, todayISO } from "@shared/data/dates";
import {
  ATTENTION_GROUP,
  attentionItems,
  KIND_META,
  pipelineStats,
  upcomingItems,
  weeklySubmissions,
  type AttentionGroup,
  type AttentionItem,
  type AttentionKind,
  type CalendarItem,
} from "@shared/data/insights";
import { AppText, Banner, Button, Card, Chip, EmptyState, Screen, Segmented } from "@/components/ui";
import { KIND_ICON } from "@/components/calendar-kinds";
import { ConversionSteps, StageBreakdown, WeeklyColumns } from "@/components/charts";
import { TasksPanel } from "@/components/tasks-panel";
import { HeaderButton } from "@/components/header-button";
import { errorMessage, useToast } from "@/components/feedback";
import { displayName, useSession } from "@/lib/session";
import { PressableScale } from "@/components/pressable-scale";
import { useTheme } from "@/theme/use-theme";
import Animated, { LayoutAnimationConfig } from "react-native-reanimated";
import { AnimatedNumber, GrowBar } from "@/components/motion";
import { useFirstVisit } from "@/lib/first-visit";
import { rise, ROW_ENTER, ROW_EXIT, ROW_LAYOUT } from "@/theme/motion";
import { shadow, TYPE } from "@/theme/tokens";

// Remembered for the session so the dashboard reopens on the view you last chose, like the website.
let lastAgendaTab: "upcoming" | "tasks" = "upcoming";
let lastPipelineTab: "overview" | "weekly" | "activity" = "overview";

/** The website's Dashboard: what needs me, what's coming, and how my search is going. */
export default function Dashboard() {
  const { applications, tasks, events, loading, error, refresh } = useData();
  const session = useSession();
  const nav = useNav();
  const router = useRouter();
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const stats = useMemo(() => pipelineStats(applications), [applications]);
  const attention = useMemo(() => attentionItems(applications, tasks), [applications, tasks]);
  const upcoming = useMemo(() => upcomingItems(applications, tasks, events, 14), [applications, tasks, events]);
  // First visit this session: blocks rise in, numbers count up, bars grow. Coming back is instant.
  const entrance = useFirstVisit("dashboard");
  const enter = (i: number) => (entrance ? rise(i) : undefined);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator />
      </View>
    );
  }

  const today = todayISO();
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const firstName = displayName(session).split(" ")[0];

  // Rolling seven days including today, so the figure doesn't reset to zero every Monday.
  const weekAgo = addDaysISO(-6);
  const appliedLast7 = applications.filter((a) => a.appliedDate && a.appliedDate >= weekAgo && a.appliedDate <= today).length;
  // Only rounds for applications still in play; a closed one's leftover dates aren't "upcoming".
  const nextRound = applications
    .filter((a) => a.status === "applied" || a.status === "interviewing")
    .flatMap((a) => a.interviewStages.filter((s) => !s.completed && s.date && s.date >= today).map((s) => ({ company: a.company, date: s.date })))
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const summary =
    applications.length === 0 ? "Let's get your search organized." : attention.length > 0 ? `${attention.length} ${attention.length === 1 ? "thing needs" : "things need"} your attention.` : "You're all caught up.";

  const pullToRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <Screen refreshing={refreshing} onRefresh={pullToRefresh}>
      <Animated.View entering={enter(0)} style={styles.header}>
        <View style={styles.dateRow}>
          <AppText variant="muted">{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</AppText>
          <HeaderButton icon="magnifyingglass" label="Search" onPress={() => router.push("/search")} />
        </View>
        <AppText variant="title" accessibilityRole="header">
          {greeting}, {firstName}
        </AppText>
        <AppText variant="muted">{summary}</AppText>
      </Animated.View>
      <Animated.View entering={enter(1)}>
        <Button variant="primary" onPress={() => nav.addApplication()}>
          Add application
        </Button>
      </Animated.View>

      {error && <Banner action={<Button onPress={refresh}>Try again</Button>}>{`Couldn't load your data: ${error}`}</Banner>}

      {applications.length === 0 ? (
        <>
          <GettingStarted />
          <Section title="Tasks">
            <TasksPanel />
          </Section>
        </>
      ) : (
        <>
          <Animated.View entering={enter(2)} style={styles.stats}>
            <StatTile
              countUp={entrance}
              index={0}
              label="In progress"
              tone="applied"
              icon="paperplane"
              value={String(stats.active)}
              sub={appliedLast7 ? `${appliedLast7} applied in the last 7 days` : stats.awaiting ? `${stats.awaiting} awaiting a reply` : `${stats.wishlist} on your wishlist`}
              hint="Applications in Applied or Interviewing"
              onPress={() => nav.applications({ view: "board" })}
            />
            <StatTile
              countUp={entrance}
              index={1}
              label="Interviewing"
              tone="interviewing"
              icon="bubble.left.and.bubble.right"
              value={String(stats.interviewing)}
              sub={nextRound ? `Next: ${nextRound.company}, ${relativeDay(nextRound.date).toLowerCase()}` : "No rounds scheduled"}
              hint="Applications currently in interview rounds"
              onPress={() => nav.applications({ status: "interviewing" })}
            />
            <StatTile
              countUp={entrance}
              index={2}
              label="Offers"
              tone="offer"
              icon="trophy"
              value={String(stats.offers)}
              sub={stats.interviewed ? `From ${stats.interviewed} ${stats.interviewed === 1 ? "application" : "applications"} interviewed` : "None yet"}
              hint="Applications with an offer"
              onPress={() => nav.applications({ status: "offer" })}
            />
            <StatTile
              countUp={entrance}
              index={3}
              label="Response rate"
              tone="accent"
              icon="chart.line.uptrend.xyaxis"
              value={stats.responseRate === null ? "—" : `${stats.responseRate}%`}
              meter={stats.responseRate}
              sub={stats.submitted ? `${stats.heardBack} of ${stats.submitted} submitted heard back` : "Nothing submitted yet"}
              hint="Submitted applications that got any reply: an interview, offer or rejection"
            />
          </Animated.View>

          <Animated.View entering={enter(3)}>
            <AttentionCard items={attention} />
          </Animated.View>
          <Animated.View entering={enter(4)}>
            <AgendaCard upcoming={upcoming} />
          </Animated.View>
          <Animated.View entering={enter(5)}>
            <PipelineCard grow={entrance} />
          </Animated.View>
        </>
      )}
    </Screen>
  );
}

/** Where the dashboard's taps go. Other tabs' screens are reached with navigate, so their stacks keep their place. */
function useNav() {
  const router = useRouter();
  return {
    addApplication: () => router.push("/applications/form"),
    application: (id: string) => router.push({ pathname: "/applications/[id]", params: { id } }),
    applications: (params: { status?: AppStatus; view?: "board" }) => router.navigate({ pathname: "/applications", params }),
    calendar: () => router.navigate("/calendar"),
    event: (id: string) => router.push({ pathname: "/calendar/event", params: { id } }),
    jobs: () => router.navigate("/jobs"),
  };
}

// ---------- Headline numbers ----------

type StatTone = "applied" | "interviewing" | "offer" | "accent";

function StatTile({
  label,
  tone,
  icon,
  value,
  sub,
  hint,
  meter,
  onPress,
  countUp,
  index,
}: {
  label: string;
  tone: StatTone;
  icon: SFSymbol;
  value: string;
  sub: string;
  hint: string;
  meter?: number | null;
  onPress?: () => void;
  /** First visit: the number counts up as the tile arrives, and the meter fills. */
  countUp: boolean;
  index: number;
}) {
  const { colors, scheme, status: palette } = useTheme();
  // Each tile borrows the color of what it counts, so the dashboard and board share one visual language.
  const look = tone === "accent" ? { soft: colors.accentSoft, fg: colors.accentFg, mark: colors.accent } : palette[tone];
  return (
    <PressableScale feel="soft"
      accessibilityRole={onPress ? "button" : "summary"}
      accessibilityLabel={`${label}: ${value}. ${hint}. ${sub}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, shadow("xs", scheme), { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={styles.tileTop}>
        <AppText variant="label" numberOfLines={2} style={styles.shrink}>
          {label}
        </AppText>
        <View style={[styles.tileIcon, { backgroundColor: look.soft }]}>
          <SymbolView name={icon} size={14} tintColor={look.fg} />
        </View>
      </View>
      <AnimatedNumber value={value} countUp={countUp} delayMs={(index + 1) * 45 + 80} style={styles.tileValue} />
      {meter !== undefined && (
        <View style={[styles.meter, { backgroundColor: colors.muted }]}>
          <GrowBar grow={countUp} delayMs={260} style={[styles.meterFill, { width: `${meter ?? 0}%`, backgroundColor: look.mark }]} />
        </View>
      )}
      <AppText variant="small" numberOfLines={2}>
        {sub}
      </AppText>
    </PressableScale>
  );
}

// ---------- Section shell ----------

function Section({ title, count, action, children }: { title: string; count?: number; action?: ReactNode; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Card>
      <View style={styles.sectionHeader}>
        <AppText variant="heading">{title}</AppText>
        {count !== undefined && (
          <View style={[styles.countPill, { backgroundColor: colors.muted }]}>
            <AppText variant="small" style={[styles.bold, { color: colors.fg2 }]}>
              {count}
            </AppText>
          </View>
        )}
      </View>
      {action}
      {children}
    </Card>
  );
}

// ---------- Needs attention ----------

const ATTENTION_GROUPS: { value: AttentionGroup; label: string; icon: SFSymbol }[] = [
  { value: "tasks", label: "Tasks", icon: "checklist" },
  { value: "deadlines", label: "Deadlines", icon: "flag" },
  { value: "interviews", label: "Interviews", icon: "bubble.left" },
  { value: "follow-ups", label: "Follow-ups", icon: "envelope" },
];

const KIND_LABEL: Record<AttentionKind, string> = {
  "task-overdue": "Overdue task",
  "task-today": "Task",
  "deadline-passed": "Missed deadline",
  "deadline-soon": "Deadline",
  "interview-soon": "Interview prep",
  "stage-unlogged": "Log outcome",
  "follow-up": "Follow-up",
};

const ATTENTION_LIMIT = 5;

function AttentionCard({ items }: { items: AttentionItem[] }) {
  const { applications, setTaskDone, updateApplication, setStageCompleted } = useData();
  const toast = useToast();
  const nav = useNav();
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<AttentionGroup | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);

  const counts = new Map<AttentionGroup, number>();
  for (const item of items) counts.set(ATTENTION_GROUP[item.kind], (counts.get(ATTENTION_GROUP[item.kind]) ?? 0) + 1);
  const groups = ATTENTION_GROUPS.filter((g) => counts.has(g.value));
  // Resolving the last item of a kind drops its filter; fall back to everything.
  const active = filter !== "all" && counts.has(filter) ? filter : "all";
  const filtered = active === "all" ? items : items.filter((i) => ATTENTION_GROUP[i.kind] === active);
  const shown = expanded ? filtered : filtered.slice(0, ATTENTION_LIMIT);

  const run = async (item: AttentionItem, action: () => Promise<void>, done: string, undo: () => Promise<void>) => {
    setBusy(item.key);
    try {
      await action();
      toast(done, { action: { label: "Undo", onPress: () => undo().catch((e) => toast(`Couldn't undo: ${errorMessage(e)}`, { tone: "error" })) } });
    } catch (e) {
      toast(`Couldn't update: ${errorMessage(e)}`, { tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  // The one-tap fix for an item, where there is one. Same three as the website.
  const resolveAction = (item: AttentionItem): { label: string; onPress: () => void } | null => {
    if (item.taskId) {
      const id = item.taskId;
      return { label: "Done", onPress: () => run(item, () => setTaskDone(id, true), "Task completed", () => setTaskDone(id, false)) };
    }
    if (item.kind === "deadline-soon" && item.appId) {
      const app = applications.find((a) => a.id === item.appId);
      if (!app) return null;
      return {
        label: "Mark applied",
        onPress: () => run(item, () => updateApplication(app.id, { status: "applied" }), `${app.company} moved to Applied`, () => updateApplication(app.id, { status: "wishlist", appliedDate: app.appliedDate })),
      };
    }
    if (item.kind === "stage-unlogged" && item.stageId) {
      const id = item.stageId;
      return { label: "Mark done", onPress: () => run(item, () => setStageCompleted(id, true), "Round marked complete", () => setStageCompleted(id, false)) };
    }
    return null;
  };

  const severity = (s: AttentionItem["severity"]) =>
    s === "danger" ? { tile: colors.dangerSoft, fg: colors.dangerFg } : s === "warning" ? { tile: colors.warningSoft, fg: colors.warningFg } : { tile: colors.muted, fg: colors.fgMuted };

  return (
    <Section
      title="Needs attention"
      count={items.length || undefined}
      action={
        groups.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityLabel="Filter attention items">
            {[{ value: "all" as const, label: "All" }, ...groups.map((g) => ({ value: g.value, label: `${g.label}  ${counts.get(g.value)}` }))].map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                active={active === option.value}
                onPress={() => {
                  setFilter(option.value);
                  setExpanded(false);
                }}
              />
            ))}
          </ScrollView>
        )
      }
    >
      {items.length === 0 ? (
        <EmptyState icon="checkmark.circle" title="You're all caught up" description="Nothing overdue, due today or waiting on you." />
      ) : (
        <>
          <LayoutAnimationConfig skipEntering>
          {shown.map((item) => {
            const group = ATTENTION_GROUPS.find((g) => g.value === ATTENTION_GROUP[item.kind])!;
            const action = resolveAction(item);
            const look = severity(item.severity);
            return (
              <Animated.View key={item.key} layout={ROW_LAYOUT} entering={ROW_ENTER} exiting={ROW_EXIT} style={styles.attentionRow}>
                <PressableScale feel="soft"
                  accessibilityRole={item.appId ? "button" : undefined}
                  accessibilityLabel={`${item.title}. ${item.when}.${item.appId ? " Open application" : ""}`}
                  disabled={!item.appId}
                  onPress={() => item.appId && nav.application(item.appId)}
                  style={styles.attentionMain}
                >
                  <View style={[styles.attentionIcon, { backgroundColor: look.tile }]}>
                    <SymbolView name={group.icon} size={15} tintColor={look.fg} />
                  </View>
                  <View style={styles.grow}>
                    <AppText numberOfLines={1}>{item.title}</AppText>
                    <AppText variant="small" numberOfLines={1}>
                      <AppText variant="small" style={[styles.bold, { color: look.fg }]}>
                        {item.when}
                      </AppText>
                      {` · ${[KIND_LABEL[item.kind], item.detail].filter(Boolean).join(" · ")}`}
                    </AppText>
                  </View>
                </PressableScale>
                {action ? (
                  <Button onPress={action.onPress} loading={busy === item.key} disabled={busy !== null && busy !== item.key} accessibilityLabel={`${action.label}: ${item.title}`} style={styles.attentionButton}>
                    {action.label}
                  </Button>
                ) : (
                  item.appId && <SymbolView name="chevron.right" size={13} tintColor={colors.fgFaint} />
                )}
              </Animated.View>
            );
          })}
          </LayoutAnimationConfig>
          {filtered.length > ATTENTION_LIMIT && (
            <Button variant="ghost" onPress={() => setExpanded((e) => !e)}>
              {expanded ? "Show fewer" : `Show ${filtered.length - ATTENTION_LIMIT} more`}
            </Button>
          )}
        </>
      )}
    </Section>
  );
}

// ---------- Agenda: upcoming + tasks ----------

function dayHeading(iso: string) {
  const d = daysUntil(iso);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return toDate(iso).toLocaleDateString("en-US", { weekday: "long" });
}

function AgendaCard({ upcoming }: { upcoming: CalendarItem[] }) {
  const { tasks } = useData();
  const [tab, setTabState] = useState(lastAgendaTab);
  const setTab = (t: typeof tab) => {
    lastAgendaTab = t;
    setTabState(t);
  };
  const openTasks = tasks.filter((t) => !t.done).length;
  return (
    <Section
      title="Agenda"
      action={
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "upcoming", label: "Upcoming" },
            { value: "tasks", label: "Tasks", count: openTasks || undefined },
          ]}
        />
      }
    >
      {tab === "upcoming" ? <UpcomingList items={upcoming} /> : <TasksPanel />}
    </Section>
  );
}

const AGENDA_LIMIT = 5;

function UpcomingList({ items }: { items: CalendarItem[] }) {
  const { applications } = useData();
  const nav = useNav();
  const { colors, kind: kindColors } = useTheme();
  const shown = items.slice(0, AGENDA_LIMIT);
  const companyOf = (id: string | null) => (id ? (applications.find((a) => a.id === id)?.company ?? "") : "");
  const open = (item: CalendarItem) => {
    if (item.event) nav.event(item.event.id);
    else if (item.applicationId) nav.application(item.applicationId);
    else nav.calendar();
  };

  if (shown.length === 0) {
    return (
      <EmptyState icon="calendar" title="Nothing in the next two weeks" description="Interviews, deadlines, dated tasks and events show up here.">
        <Button onPress={nav.calendar} style={styles.topGap}>
          Open Calendar
        </Button>
      </EmptyState>
    );
  }

  return (
    <>
      {shown.map((item, i) => {
        const startsDay = i === 0 || shown[i - 1].date !== item.date;
        // Tasks and events don't carry the role; show whichever context the item has.
        const context = item.kind === "interview" || item.kind === "deadline" ? item.detail : companyOf(item.applicationId);
        return (
          <View key={item.id}>
            {startsDay && (
              <AppText variant="small" style={[styles.dayHeading, i > 0 && styles.topGap]}>
                <AppText variant="small" style={[styles.bold, { color: daysUntil(item.date) === 0 ? colors.accentFg : colors.fg2 }]}>
                  {dayHeading(item.date)}
                </AppText>
                {`  ${formatDate(item.date)}`}
              </AppText>
            )}
            <PressableScale feel="soft" accessibilityRole="button" onPress={() => open(item)} style={({ pressed }) => [styles.upcomingRow, pressed && { backgroundColor: colors.subtle }]}>
              <SymbolView name={KIND_ICON[item.kind]} size={15} tintColor={kindColors[item.kind]} />
              <View style={styles.grow}>
                <AppText numberOfLines={1}>{item.label}</AppText>
                <AppText variant="small" numberOfLines={1}>
                  {[KIND_META[item.kind].label, context].filter(Boolean).join(" · ")}
                </AppText>
              </View>
              {item.time ? <AppText variant="small">{formatTime(item.time)}</AppText> : null}
            </PressableScale>
          </View>
        );
      })}
      <Button variant="ghost" onPress={nav.calendar}>
        {items.length > shown.length ? `${items.length - shown.length} more in the next two weeks` : "Open Calendar"}
      </Button>
    </>
  );
}

// ---------- Pipeline: one view at a time ----------

/** Below this many submissions a single reply swings the rates by 20+ points, so we say so. */
const SMALL_SAMPLE = 5;

function PipelineCard({ grow }: { grow: boolean }) {
  const { applications, recentActivity } = useData();
  const nav = useNav();
  const stats = useMemo(() => pipelineStats(applications), [applications]);
  const weeks = useMemo(() => weeklySubmissions(applications, 12), [applications]);
  const [tab, setTabState] = useState(lastPipelineTab);
  const setTab = (t: typeof tab) => {
    lastPipelineTab = t;
    setTabState(t);
  };

  return (
    <Section
      title="Pipeline"
      action={
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "overview", label: "Overview" },
            { value: "weekly", label: "Weekly" },
            { value: "activity", label: "Activity" },
          ]}
        />
      }
    >
      {tab === "overview" && (
        <>
          <SubHeading title="By stage" note={`${stats.total} tracked · tap a stage to filter`} />
          <StageBreakdown applications={applications} onSelect={(status) => nav.applications({ status })} grow={grow && tab === "overview"} />
          <SubHeading title="Conversion" />
          {stats.submitted === 0 ? (
            <AppText variant="muted">{"Rates appear once you've moved an application past Wishlist."}</AppText>
          ) : (
            <>
              <ConversionSteps
                grow={grow}
                steps={[
                  { label: "Submitted", value: stats.submitted },
                  { label: "Heard back", value: stats.heardBack },
                  { label: "Interviewed", value: stats.interviewed },
                  { label: "Offer", value: stats.offers },
                ]}
              />
              <AppText variant="small">
                Each rate is the share of the step before it.
                {stats.submitted < SMALL_SAMPLE && " With only a few submissions, expect these to move a lot."}
              </AppText>
            </>
          )}
        </>
      )}
      {tab === "weekly" && <WeeklyColumns weeks={weeks} title="Submissions per week" />}
      {tab === "activity" && (recentActivity.length === 0 ? <AppText variant="muted">Changes to your applications show up here.</AppText> : <ActivityList items={recentActivity} />)}
    </Section>
  );
}

function SubHeading({ title, note }: { title: string; note?: string }) {
  return (
    <View style={styles.subHeading}>
      <AppText variant="small" style={styles.bold}>
        {title}
      </AppText>
      {note && <AppText variant="small">{note}</AppText>}
    </View>
  );
}

function ActivityList({ items }: { items: ActivityItem[] }) {
  const nav = useNav();
  const { colors, status: palette } = useTheme();
  const dot: Record<ActivityItem["icon"], string> = {
    offer: palette.offer.mark,
    rejected: palette.rejected.mark,
    interview: palette.interviewing.mark,
    added: colors.lineStrong,
    status: palette.applied.mark,
  };
  return (
    <>
      {items.map((item) => (
        <PressableScale feel="soft" key={item.id} accessibilityRole="button" onPress={() => nav.application(item.id)} style={({ pressed }) => [styles.activityRow, pressed && { backgroundColor: colors.subtle }]}>
          <View style={[styles.activityDot, { backgroundColor: dot[item.icon] }]} />
          <AppText numberOfLines={1} style={styles.grow}>
            {item.text}
          </AppText>
          <AppText variant="small">{item.time}</AppText>
        </PressableScale>
      ))}
    </>
  );
}

// ---------- Empty account ----------

function GettingStarted() {
  const nav = useNav();
  const { colors } = useTheme();
  const options: { icon: SFSymbol; title: string; text: string; onPress: () => void }[] = [
    { icon: "plus", title: "Add an application", text: "Company, role, deadline. About ten seconds.", onPress: nav.addApplication },
    { icon: "square.and.arrow.down", title: "Import a spreadsheet", text: "Bring an existing tracker in from a CSV.", onPress: () => nav.applications({}) },
    { icon: "briefcase", title: "Find openings", text: "Browse listings or get resume matches.", onPress: nav.jobs },
  ];
  return (
    <Section title="Start tracking your search">
      <AppText variant="muted">{"Once you add applications, this page shows what needs attention, what's coming up and how your search is going."}</AppText>
      {options.map((opt) => (
        <PressableScale feel="soft" key={opt.title} accessibilityRole="button" onPress={opt.onPress} style={({ pressed }) => [styles.startOption, { borderColor: colors.line, opacity: pressed ? 0.8 : 1 }]}>
          <View style={[styles.startIcon, { backgroundColor: colors.muted }]}>
            <SymbolView name={opt.icon} size={16} tintColor={colors.fg2} />
          </View>
          <View style={styles.grow}>
            <AppText style={styles.bold}>{opt.title}</AppText>
            <AppText variant="small">{opt.text}</AppText>
          </View>
        </PressableScale>
      ))}
    </Section>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { gap: 4, marginTop: 8 },
  dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  grow: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  bold: { fontWeight: "600" },
  topGap: { marginTop: 8 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  chips: { gap: 8 },
  tile: { width: "47.5%", flexGrow: 1, borderWidth: StyleSheet.hairlineWidth, borderCurve: "continuous", borderRadius: 12, padding: 14, gap: 8 },
  tileTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  tileIcon: { width: 28, height: 28, borderCurve: "continuous", borderRadius: 8, alignItems: "center", justifyContent: "center" },
  tileValue: TYPE.display,
  meter: { height: 6, borderCurve: "continuous", borderRadius: 3, overflow: "hidden" },
  meterFill: { height: "100%", borderCurve: "continuous", borderRadius: 3 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  countPill: { borderCurve: "continuous", borderRadius: 999, paddingHorizontal: 7 },
  attentionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  attentionMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  attentionIcon: { width: 32, height: 32, borderCurve: "continuous", borderRadius: 8, alignItems: "center", justifyContent: "center" },
  attentionButton: { minHeight: 36, paddingHorizontal: 12 },
  dayHeading: { paddingBottom: 2 },
  upcomingRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, borderCurve: "continuous", borderRadius: 8 },
  subHeading: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginTop: 4 },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 40, borderCurve: "continuous", borderRadius: 8 },
  activityDot: { width: 7, height: 7, borderCurve: "continuous", borderRadius: 4 },
  startOption: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderCurve: "continuous", borderRadius: 10, padding: 12 },
  startIcon: { width: 32, height: 32, borderCurve: "continuous", borderRadius: 8, alignItems: "center", justifyContent: "center" },
});
