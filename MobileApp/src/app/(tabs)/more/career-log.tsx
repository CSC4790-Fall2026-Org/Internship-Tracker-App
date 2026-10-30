import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { CAREER_CATEGORIES, type CareerCategory } from "@shared/data/careerLog";
import { formatDate } from "@shared/data/dates";
import { useData } from "@shared/data/DataContext";
import { AppText, Banner, Button, Card, Chip, CompanyLogo, EmptyState, Screen } from "@/components/ui";
import { CategoryBadge } from "@/components/category-badge";
import { HeaderButton } from "@/components/header-button";
import { useCareerLog } from "@/data/career-log-store";
import { PressableScale } from "@/components/pressable-scale";
import { useTheme } from "@/theme/use-theme";

/** The website's Career log: wins, projects, feedback, skills and milestones, newest first. */
export default function CareerLog() {
  const { entries, loading, error, reload, refresh } = useCareerLog();
  const { applications } = useData();
  const router = useRouter();
  const { colors } = useTheme();
  const [category, setCategory] = useState<CareerCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const counts = useMemo(() => {
    const out = { all: entries.length } as Record<CareerCategory | "all", number>;
    for (const c of CAREER_CATEGORIES) out[c.value] = 0;
    for (const e of entries) out[e.category]++;
    return out;
  }, [entries]);

  const applicationById = useMemo(() => new Map(applications.map((a) => [a.id, a])), [applications]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (category === "all" || e.category === category) &&
        (!q || [e.title, e.details, e.impact, (e.applicationId && applicationById.get(e.applicationId)?.company) || ""].some((field) => field.toLowerCase().includes(q))),
    );
  }, [entries, category, search, applicationById]);

  // New entries start in the category being filtered, if any.
  const add = () => router.push({ pathname: "/more/entry", params: category === "all" ? {} : { category } });

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions:
            entries.length > 0 ? { placeholder: "Search titles, details, impact, companies", hideWhenScrolling: false, onChangeText: (e) => setSearch(e.nativeEvent.text), onCancelButtonPress: () => setSearch("") } : undefined,
          headerRight: () => (loading || error ? null : <HeaderButton icon="plus" label="Add entry" onPress={add} />),
        }}
      />
      <Screen
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await refresh();
          setRefreshing(false);
        }}
      >
        {error ? (
          <Banner action={<Button onPress={reload}>Retry</Button>}>{`Couldn't load your career log: ${error}`}</Banner>
        ) : loading ? (
          <View style={styles.loading}>
            <ActivityIndicator />
          </View>
        ) : entries.length === 0 ? (
          <Card>
            <EmptyState icon="trophy" title="Nothing logged yet" description="Add the things you'd want to mention in a review, an interview or a resume update. Small wins count.">
              <Button variant="primary" onPress={add} style={styles.topGap}>
                Log your first entry
              </Button>
            </EmptyState>
          </Card>
        ) : (
          <>
            <View style={styles.summary}>
              <AppText variant="muted">{`${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}</AppText>
              <HeaderButton label="Brag doc" onPress={() => router.push("/more/brag-doc")} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityLabel="Filter by category">
              {[{ value: "all" as const, plural: "All" }, ...CAREER_CATEGORIES].map((c) => (
                <Chip key={c.value} label={`${c.plural}  ${counts[c.value]}`} active={category === c.value} onPress={() => setCategory(c.value)} />
              ))}
            </ScrollView>

            {filtered.length === 0 ? (
              <Card>
                <EmptyState icon="magnifyingglass" title="No matching entries" description={search ? `Nothing matches “${search}”.` : "Nothing in this category yet."}>
                  {category !== "all" && (
                    <Button onPress={() => setCategory("all")} style={styles.topGap}>
                      Show all categories
                    </Button>
                  )}
                </EmptyState>
              </Card>
            ) : (
              <Card style={styles.list}>
                {filtered.map((entry, i) => {
                  const app = entry.applicationId ? applicationById.get(entry.applicationId) : undefined;
                  return (
                    <PressableScale feel="soft"
                      key={entry.id}
                      accessibilityRole="button"
                      onPress={() => router.push({ pathname: "/more/entry", params: { id: entry.id } })}
                      style={({ pressed }) => [styles.entry, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }, pressed && { backgroundColor: colors.subtle }]}
                    >
                      <View style={styles.entryTop}>
                        <CategoryBadge category={entry.category} />
                        <View style={styles.grow} />
                        <AppText variant="small">{formatDate(entry.date)}</AppText>
                      </View>
                      <AppText style={styles.title}>{entry.title}</AppText>
                      {entry.impact ? (
                        <AppText style={{ color: colors.fg2 }}>
                          <AppText style={[styles.bold, { color: colors.fg2 }]}>Impact: </AppText>
                          {entry.impact}
                        </AppText>
                      ) : null}
                      {entry.details ? (
                        <AppText variant="muted" numberOfLines={2}>
                          {entry.details}
                        </AppText>
                      ) : null}
                      {app && (
                        <View style={styles.linked}>
                          <CompanyLogo name={app.company} initials={app.logoInitials} color={app.logoColor} size={18} />
                          <AppText variant="small" numberOfLines={1} style={styles.grow}>
                            {app.company} · {app.position}
                          </AppText>
                        </View>
                      )}
                    </PressableScale>
                  );
                })}
              </Card>
            )}
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 48, alignItems: "center" },
  topGap: { marginTop: 8 },
  summary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chips: { gap: 8, paddingRight: 16 },
  list: { padding: 0, gap: 0, overflow: "hidden" },
  entry: { paddingHorizontal: 16, paddingVertical: 14, gap: 6 },
  entryTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontWeight: "600" },
  bold: { fontWeight: "600" },
  grow: { flex: 1, minWidth: 0 },
  linked: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
});
