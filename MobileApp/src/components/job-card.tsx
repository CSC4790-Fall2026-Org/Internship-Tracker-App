import { Pressable, StyleSheet, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { SymbolView } from "expo-symbols";
import type { Application } from "@shared/data/types";
import { logoFor } from "@shared/data/DataContext";
import { formatSalary, type JobListing, type JobRecommendation } from "@shared/data/jobs";
import { STATUS } from "@shared/data/status";
import { timeAgo } from "@shared/data/dates";
import { AppText, Badge, Button, Card, CompanyLogo, StatusDot } from "@/components/ui";
import { useTheme } from "@/theme/use-theme";

export const companyOf = (job: JobListing) => job.company || "Unknown company";

export interface JobCardProps {
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

/**
 * The website's job card. Apply opens the listing in an in-app browser; once it's closed, the card asks whether you
 * applied, so tracking it is one tap.
 */
export function JobCard({ job, recommendation, tracked, askedAboutApplying, saving, onApplyClicked, onDismissApplied, onTrack, onOpenTracked }: JobCardProps) {
  const { colors } = useTheme();
  const logo = logoFor(companyOf(job));
  const salary = formatSalary(job);
  const meta = [job.location, job.contractTime === "full_time" ? "Full-time" : job.contractTime === "part_time" ? "Part-time" : "", job.created ? timeAgo(job.created) : ""].filter(Boolean);
  const showAppliedPrompt = askedAboutApplying && (!tracked || tracked.status === "wishlist");

  const apply = async () => {
    await WebBrowser.openBrowserAsync(job.url);
    onApplyClicked();
  };

  return (
    <Card>
      <View style={styles.top}>
        <CompanyLogo name={companyOf(job)} initials={logo.logo_initials} color={logo.logo_color} size={36} />
        <View style={styles.grow}>
          <AppText style={styles.title}>{job.title}</AppText>
          <AppText style={{ color: colors.fg2 }}>{companyOf(job)}</AppText>
          <AppText variant="small">{meta.join(" · ")}</AppText>
          {salary ? (
            <AppText variant="small" style={[styles.salary, { color: colors.fg2 }]}>
              {salary}
              {job.salaryPredicted ? (
                <AppText variant="small" style={styles.estimate} onPress={() => WebBrowser.openBrowserAsync("https://www.adzuna.com/jobs/salary-predictor.html")}>
                  {"  Adzuna Jobsworth estimate"}
                </AppText>
              ) : null}
            </AppText>
          ) : null}
        </View>
        {recommendation && <Badge tone={recommendation.score >= 80 ? "success" : recommendation.score >= 60 ? "accent" : "neutral"}>{`${recommendation.score}% match`}</Badge>}
      </View>

      {recommendation ? (
        <View style={[styles.insight, { backgroundColor: colors.accentSoft }]}>
          <View style={styles.insightLabel}>
            <SymbolView name="sparkles" size={11} tintColor={colors.accentFg} />
            <AppText style={[styles.insightLabelText, { color: colors.accentFg }]}>AI INSIGHT</AppText>
          </View>
          <AppText>{recommendation.reason}</AppText>
          {recommendation.matchedSkills.length > 0 && (
            <View style={styles.skills}>
              {recommendation.matchedSkills.map((skill) => (
                <View key={skill} style={[styles.skill, { backgroundColor: colors.surface }]}>
                  <AppText style={[styles.skillText, { color: colors.accentFg }]}>{skill}</AppText>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : job.description ? (
        <AppText variant="muted" numberOfLines={3}>
          {job.description}
        </AppText>
      ) : null}

      {showAppliedPrompt && (
        <View style={[styles.prompt, { backgroundColor: colors.accentSoft }]}>
          <AppText style={[styles.grow, styles.bold, { color: colors.accentFg }]}>Did you apply?</AppText>
          <Button variant="ghost" onPress={onDismissApplied} disabled={saving}>
            Not yet
          </Button>
          <Button variant="primary" onPress={() => onTrack("applied")} loading={saving}>
            {tracked ? "Mark applied" : "Yes, track it"}
          </Button>
        </View>
      )}

      <View style={styles.actions}>
        <Button variant="primary" onPress={apply} style={styles.grow}>
          Apply
        </Button>
        {tracked ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Tracked, ${STATUS[tracked.status].label}. Open in your tracker`}
            onPress={() => onOpenTracked(tracked.id)}
            style={[styles.tracked, { borderColor: colors.line, backgroundColor: colors.surface }]}
          >
            <SymbolView name="checkmark" size={13} weight="semibold" tintColor={colors.success} />
            <StatusDot status={tracked.status} />
            <AppText style={styles.bold}>{STATUS[tracked.status].label}</AppText>
          </Pressable>
        ) : (
          <Button onPress={() => onTrack("wishlist")} loading={saving} style={styles.grow} accessibilityHint="Adds it to your Wishlist to apply later">
            Save for later
          </Button>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  grow: { flex: 1, minWidth: 0 },
  bold: { fontWeight: "600" },
  title: { fontSize: 16, fontWeight: "600" },
  salary: { fontWeight: "500", marginTop: 2 },
  estimate: { textDecorationLine: "underline", fontWeight: "400" },
  insight: { borderCurve: "continuous", borderRadius: 10, padding: 12, gap: 6 },
  insightLabel: { flexDirection: "row", alignItems: "center", gap: 5 },
  insightLabelText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  skills: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  skill: { borderCurve: "continuous", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  skillText: { fontSize: 12, fontWeight: "500" },
  prompt: { flexDirection: "row", alignItems: "center", gap: 6, borderCurve: "continuous", borderRadius: 10, paddingLeft: 12, paddingRight: 6, paddingVertical: 6 },
  actions: { flexDirection: "row", gap: 8 },
  tracked: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, borderWidth: 1, borderCurve: "continuous", borderRadius: 10 },
});
