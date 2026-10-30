import { useMemo, useState } from "react";
import { ActivityIndicator, Share, StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { CAREER_CATEGORIES, type CareerCategory } from "@shared/data/careerLog";
import { BRAG_CATEGORIES, bragDocMarkdown, bragDocText, bragSections, type BragPeriod } from "@shared/data/bragDoc";
import { formatDate } from "@shared/data/dates";
import { useData } from "@shared/data/DataContext";
import { AppText, Banner, Button, Card, Chip, EmptyState, Screen, Segmented } from "@/components/ui";
import { HeaderMenu, type MenuEntry } from "@/components/native-menu";
import { errorMessage, useToast } from "@/components/feedback";
import { useCareerLog } from "@/data/career-log-store";
import { useTheme } from "@/theme/use-theme";

const PERIODS: { value: BragPeriod; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

/** The website's Brag doc: a view over the career log, grouped by period, ready to copy or share. */
export default function BragDoc() {
  const { entries, loading, error, reload } = useCareerLog();
  const { applications } = useData();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const [period, setPeriod] = useState<BragPeriod>("quarter");
  const [categories, setCategories] = useState<CareerCategory[]>(BRAG_CATEGORIES);

  const companyById = useMemo(() => new Map(applications.map((a) => [a.id, a.company])), [applications]);
  const companyOf = (id: string) => companyById.get(id);

  const eligible = useMemo(() => entries.filter((e) => BRAG_CATEGORIES.includes(e.category)), [entries]);
  const sections = useMemo(() => bragSections(eligible, period, categories), [eligible, period, categories]);
  const shownCount = sections.reduce((n, s) => n + s.count, 0);

  const counts = useMemo(() => {
    const out = {} as Record<CareerCategory, number>;
    for (const c of BRAG_CATEGORIES) out[c] = 0;
    for (const e of eligible) out[e.category]++;
    return out;
  }, [eligible]);

  // Keep at least one category on, so the doc never goes blank by accident.
  const toggleCategory = (c: CareerCategory) =>
    setCategories((current) => (current.includes(c) ? (current.length > 1 ? current.filter((x) => x !== c) : current) : BRAG_CATEGORIES.filter((x) => x === c || current.includes(x))));

  const copy = async (format: "text" | "markdown") => {
    try {
      await Clipboard.setStringAsync(format === "markdown" ? bragDocMarkdown(sections, companyOf) : bragDocText(sections, companyOf));
      toast(format === "markdown" ? "Copied as Markdown" : "Copied as text");
    } catch (e) {
      toast(`Couldn't copy: ${errorMessage(e)}`, { tone: "error" });
    }
  };

  // The share sheet sends plain text: it pastes cleanly into Mail, Notes and Messages.
  const share = () => Share.share({ message: bragDocText(sections, companyOf) }).catch((e) => toast(`Couldn't share: ${errorMessage(e)}`, { tone: "error" }));

  const exportMenu: MenuEntry[] = [
    { label: "Share…", icon: "square.and.arrow.up", onPress: share },
    "divider",
    { label: "Copy as text", icon: "doc.on.doc", onPress: () => copy("text") },
    { label: "Copy as Markdown", icon: "doc.plaintext", onPress: () => copy("markdown") },
  ];

  const ready = !loading && !error && eligible.length > 0;

  return (
    <>
      <Stack.Screen options={{ headerRight: () => (ready ? <HeaderMenu icon="square.and.arrow.up" label="Share or copy" items={exportMenu} /> : null) }} />
      <Screen>
        <AppText variant="muted">
          {ready
            ? `${shownCount} ${shownCount === 1 ? "entry" : "entries"} from your career log, grouped by ${period}`
            : "Accomplishments, projects and feedback from your career log, ready to paste into a review or resume."}
        </AppText>

        {error ? (
          <Banner action={<Button onPress={reload}>Retry</Button>}>{`Couldn't load your career log: ${error}`}</Banner>
        ) : loading ? (
          <View style={styles.loading}>
            <ActivityIndicator />
          </View>
        ) : eligible.length === 0 ? (
          <Card>
            <EmptyState icon="trophy" title="Nothing for your brag doc yet" description="It's built from the accomplishments, projects and feedback in your career log. Log a few and they'll show up here.">
              <Button variant="primary" onPress={() => router.navigate("/more/career-log")} style={styles.topGap}>
                Go to career log
              </Button>
            </EmptyState>
          </Card>
        ) : (
          <>
            <View accessibilityLabel="Include categories" style={styles.chips}>
              {CAREER_CATEGORIES.filter((c) => BRAG_CATEGORIES.includes(c.value)).map((c) => (
                <Chip key={c.value} label={`${c.plural}  ${counts[c.value]}`} active={categories.includes(c.value)} onPress={() => toggleCategory(c.value)} />
              ))}
            </View>
            <Segmented value={period} onChange={setPeriod} options={PERIODS} />

            <Card style={styles.doc}>
              {sections.map((section, i) => (
                <View key={section.key} style={[styles.section, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }]}>
                  <View style={styles.sectionHeader}>
                    <AppText variant="heading" accessibilityRole="header" style={styles.shrink}>
                      {section.label}
                    </AppText>
                    <AppText variant="small">{`${section.count} ${section.count === 1 ? "entry" : "entries"}`}</AppText>
                  </View>
                  {section.groups.map((group) => (
                    <View key={group.category} style={styles.group}>
                      <AppText variant="small" style={styles.groupLabel}>
                        {group.label}
                      </AppText>
                      {group.entries.map((entry) => {
                        const company = entry.applicationId ? companyOf(entry.applicationId) : undefined;
                        return (
                          <View key={entry.id} style={styles.item}>
                            <View style={[styles.bullet, { backgroundColor: colors.fgFaint }]} />
                            <View style={styles.grow}>
                              <AppText>
                                <AppText style={styles.bold}>{entry.title}</AppText>
                                <AppText variant="muted">{` · ${formatDate(entry.date)}${company ? ` · ${company}` : ""}`}</AppText>
                              </AppText>
                              {entry.impact ? (
                                <AppText style={{ color: colors.fg2 }}>
                                  <AppText style={[styles.bold, { color: colors.fg2 }]}>Impact: </AppText>
                                  {entry.impact}
                                </AppText>
                              ) : null}
                              {entry.details ? <AppText variant="muted">{entry.details}</AppText> : null}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              ))}
            </Card>

            <AppText variant="small">Edit or remove entries in the career log and this updates to match.</AppText>
            <Button variant="ghost" onPress={() => router.navigate("/more/career-log")}>
              Open career log →
            </Button>
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 48, alignItems: "center" },
  topGap: { marginTop: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  doc: { padding: 0, gap: 0 },
  section: { paddingHorizontal: 16, paddingVertical: 16, gap: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  group: { gap: 10 },
  groupLabel: { fontWeight: "500" },
  item: { flexDirection: "row", gap: 10 },
  bullet: { width: 6, height: 6, borderCurve: "continuous", borderRadius: 3, marginTop: 8 },
  grow: { flex: 1, minWidth: 0, gap: 3 },
  shrink: { flexShrink: 1 },
  bold: { fontWeight: "600" },
});
