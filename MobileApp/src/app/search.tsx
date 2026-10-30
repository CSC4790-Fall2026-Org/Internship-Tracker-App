import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { SymbolView, type SFSymbol } from "expo-symbols";
import type { AppStatus } from "@shared/data/types";
import { useData } from "@shared/data/DataContext";
import { STATUS } from "@shared/data/status";
import { formatDate } from "@shared/data/dates";
import { AppText, Card, CompanyLogo, EmptyState, Input, Screen, StatusDot } from "@/components/ui";
import { HeaderButton } from "@/components/header-button";
import { PressableScale } from "@/components/pressable-scale";
import { useTheme } from "@/theme/use-theme";

type ResultGroup = "Actions" | "Applications" | "People" | "Events" | "Tasks" | "Go to";

interface Result {
  key: string;
  group: ResultGroup;
  title: string;
  subtitle: string;
  /** Extra text that should match a query without being shown. */
  haystack: string;
  href: Href;
  icon?: SFSymbol;
  logo?: { name: string; color: string; initials: string };
  status?: AppStatus;
}

const GROUP_ORDER: ResultGroup[] = ["Actions", "Applications", "People", "Events", "Tasks", "Go to"];

// The website's search palette pages, pointed at where each one lives in the app.
const PAGES: { label: string; href: Href; hint: string; icon: SFSymbol }[] = [
  { label: "Dashboard", href: "/", hint: "What needs attention, upcoming, pipeline", icon: "house" },
  { label: "Board", href: { pathname: "/applications", params: { view: "board" } }, hint: "Applications by stage, and insights", icon: "rectangle.split.3x1" },
  { label: "Applications", href: "/applications", hint: "Full sortable list, import and export", icon: "list.bullet.rectangle" },
  { label: "Calendar", href: "/calendar", hint: "Month and week views", icon: "calendar" },
  { label: "Jobs", href: "/jobs", hint: "Matches from your resume and job search", icon: "briefcase" },
  { label: "Networking", href: "/more/networking", hint: "Contacts and outreach", icon: "person.2" },
  { label: "Career log", href: "/more/career-log", hint: "Accomplishments, projects, feedback, skills, milestones", icon: "trophy" },
  { label: "Brag doc", href: "/more/brag-doc", hint: "Your wins grouped by period, ready to copy", icon: "doc.text" },
  { label: "Career Coach", href: "/more/coach", hint: "AI advice grounded in your applications and career log", icon: "sparkles" },
  { label: "Profile", href: "/more/profile", hint: "Resume and extracted profile", icon: "person.crop.circle" },
];

const ACTIONS: Result[] = [
  { key: "action-add", group: "Actions", title: "Add application", subtitle: "Track a new role", haystack: "new create application job", href: "/applications/form", icon: "plus" },
  { key: "action-calendar", group: "Actions", title: "Open today in the calendar", subtitle: "See what's scheduled", haystack: "today schedule event", href: "/calendar", icon: "calendar" },
];

/** Case-insensitive match; earlier matches in the title rank higher. Same as the website. */
function scoreOf(query: string, title: string, haystack: string): number {
  const q = query.toLowerCase();
  const t = title.toLowerCase();
  if (t.startsWith(q)) return 0;
  const inTitle = t.indexOf(q);
  if (inTitle > -1) return 1 + inTitle / 100;
  const inHay = haystack.toLowerCase().indexOf(q);
  if (inHay > -1) return 50 + inHay / 100;
  return -1;
}

/** The website's ⌘K search palette: applications, people, events, tasks and pages, grouped and ranked. */
export default function Search() {
  const { applications, contacts, tasks, events } = useData();
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q ?? "");

  const everything = useMemo<Result[]>(() => {
    const out: Result[] = [...ACTIONS];
    for (const app of applications) {
      out.push({
        key: `app-${app.id}`,
        group: "Applications",
        title: `${app.company} · ${app.position}`,
        subtitle: [STATUS[app.status].label, app.location].filter(Boolean).join(" · "),
        haystack: [app.notes, app.location, app.salary, STATUS[app.status].label].join(" "),
        href: { pathname: "/applications/[id]", params: { id: app.id } },
        logo: { name: app.company, color: app.logoColor, initials: app.logoInitials },
        status: app.status,
      });
    }
    for (const contact of contacts) {
      out.push({
        key: `contact-${contact.id}`,
        group: "People",
        title: contact.name,
        subtitle: [contact.role, contact.company].filter(Boolean).join(" · "),
        haystack: [contact.email, contact.phone, contact.notes].join(" "),
        href: { pathname: "/more/contact", params: { id: contact.id } },
        icon: "person",
      });
    }
    for (const task of tasks) {
      out.push({
        key: `task-${task.id}`,
        group: "Tasks",
        title: task.text,
        subtitle: [task.company, task.done ? "Done" : task.due ? `Due ${formatDate(task.due)}` : "Open"].filter(Boolean).join(" · "),
        haystack: task.company,
        // Tasks live on the dashboard's Agenda, or on their application.
        href: task.applicationId ? { pathname: "/applications/[id]", params: { id: task.applicationId } } : "/",
        icon: "checklist",
      });
    }
    for (const event of events) {
      out.push({ key: `event-${event.id}`, group: "Events", title: event.title, subtitle: formatDate(event.date, { weekday: true }), haystack: event.notes, href: { pathname: "/calendar/event", params: { id: event.id } }, icon: "calendar" });
    }
    for (const page of PAGES) {
      out.push({ key: `page-${page.label}`, group: "Go to", title: page.label, subtitle: page.hint, haystack: page.hint, href: page.href, icon: page.icon });
    }
    return out;
  }, [applications, contacts, tasks, events]);

  const results = useMemo(() => {
    const q = query.trim();
    // With no query, offer actions and the pages as a plain jump list.
    if (!q) return everything.filter((r) => r.group === "Go to" || r.group === "Actions");
    return everything
      .map((result) => ({ result, score: scoreOf(q, result.title, result.haystack) }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => a.score - b.score || a.result.title.localeCompare(b.result.title))
      .slice(0, 12)
      .map((r) => r.result);
  }, [everything, query]);

  const grouped = GROUP_ORDER.map((group) => ({ group, items: results.filter((r) => r.group === group) })).filter((g) => g.items.length > 0);

  const open = (result: Result) => {
    // Close Search first, so Back from the result returns to where you were rather than to Search.
    router.dismiss();
    router.navigate(result.href);
  };

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <HeaderButton label="Done" bold onPress={() => router.back()} /> }} />
      <Screen>
        <Input
          autoFocus
          accessibilityLabel="Search"
          value={query}
          onChangeText={setQuery}
          placeholder="Search applications, people, events, tasks and pages"
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
          onSubmitEditing={() => results[0] && open(results[0])}
        />
        {results.length === 0 ? (
          <Card>
            <EmptyState icon="magnifyingglass" title="No results" description={`Nothing matches “${query.trim()}”.`} />
          </Card>
        ) : (
          grouped.map(({ group, items }) => (
            <View key={group} style={styles.group}>
              <AppText variant="small" style={styles.groupLabel} accessibilityRole="header">
                {group}
              </AppText>
              <Card style={styles.list}>
                {items.map((r, i) => (
                  <PressableScale feel="soft"
                    key={r.key}
                    accessibilityRole="button"
                    onPress={() => open(r)}
                    style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }, pressed && { backgroundColor: colors.subtle }]}
                  >
                    {r.logo ? (
                      <CompanyLogo name={r.logo.name} initials={r.logo.initials} color={r.logo.color} size={28} />
                    ) : (
                      <View style={[styles.icon, { backgroundColor: colors.muted }]}>
                        <SymbolView name={r.icon ?? "arrow.right"} size={14} tintColor={colors.fg2} />
                      </View>
                    )}
                    <View style={styles.grow}>
                      <AppText numberOfLines={1}>{r.title}</AppText>
                      {r.subtitle ? (
                        <AppText variant="small" numberOfLines={1}>
                          {r.subtitle}
                        </AppText>
                      ) : null}
                    </View>
                    {r.status && <StatusDot status={r.status} />}
                  </PressableScale>
                ))}
              </Card>
            </View>
          ))
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  groupLabel: { fontWeight: "600", marginLeft: 4 },
  list: { padding: 0, gap: 0, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 14, paddingVertical: 8 },
  icon: { width: 28, height: 28, borderCurve: "continuous", borderRadius: 7, alignItems: "center", justifyContent: "center" },
  grow: { flex: 1, minWidth: 0 },
});
