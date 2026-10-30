// Pieces shared by the Applications list, Board and detail screens.
import { StyleSheet, View } from "react-native";
import { SymbolView } from "expo-symbols";
import type { Application, AppStatus } from "@shared/data/types";
import { STATUS } from "@shared/data/status";
import { formatDate } from "@shared/data/dates";
import { AppText, Checkbox, CompanyLogo, DueChip, StatusBadge } from "@/components/ui";
import { PressableScale } from "@/components/pressable-scale";
import { useTheme } from "@/theme/use-theme";
import { shadow } from "@/theme/tokens";

/** Deadlines only matter before you've heard back, the same rule as the website's table and board. */
const deadlineMatters = (app: Application) => !!app.deadline && (app.status === "wishlist" || app.status === "applied");

/** One application in the list: logo, company and role, stage, and the date that matters. */
export function ApplicationRow({
  app,
  onPress,
  onLongPress,
  selecting,
  selected,
  onToggleSelect,
}: {
  app: Application;
  onPress: () => void;
  onLongPress?: () => void;
  selecting?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale feel="soft"
      accessibilityRole="button"
      accessibilityHint={selecting ? undefined : "Opens the application. Touch and hold for more actions."}
      onPress={selecting ? onToggleSelect : onPress}
      onLongPress={selecting ? undefined : onLongPress}
      style={({ pressed }) => [styles.row, { backgroundColor: selected ? colors.accentSoft : pressed ? colors.subtle : colors.surface }]}
    >
      {selecting && <Checkbox checked={!!selected} onPress={onToggleSelect ?? (() => {})} label={`Select ${app.company} ${app.position}`} />}
      <CompanyLogo name={app.company} initials={app.logoInitials} color={app.logoColor} size={36} />
      <View style={styles.rowText}>
        <AppText style={styles.company} numberOfLines={1}>
          {app.company}
        </AppText>
        <AppText variant="small" numberOfLines={1}>
          {app.position}
        </AppText>
      </View>
      <View style={styles.rowMeta}>
        <StatusBadge status={app.status} />
        {deadlineMatters(app) ? <DueChip date={app.deadline} /> : app.appliedDate ? <AppText variant="small">{formatDate(app.appliedDate)}</AppText> : null}
      </View>
    </PressableScale>
  );
}

/** A Board card, like the website's: company, role, location, the date or pay, and interview progress. */
export function BoardCard({ app, onPress, onLongPress }: { app: Application; onPress: () => void; onLongPress: () => void }) {
  const { colors, scheme, status: palette } = useTheme();
  const showDeadline = deadlineMatters(app);
  return (
    <PressableScale feel="soft"
      accessibilityRole="button"
      accessibilityLabel={`${app.company}, ${app.position}`}
      accessibilityHint="Opens the application. Touch and hold to move it to another stage."
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.card, shadow("xs", scheme), { backgroundColor: colors.surface, borderColor: colors.line, borderLeftColor: palette[app.status].mark, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.cardTop}>
        <CompanyLogo name={app.company} initials={app.logoInitials} color={app.logoColor} size={28} />
        <View style={styles.rowText}>
          <AppText style={styles.company} numberOfLines={1}>
            {app.company}
          </AppText>
          <AppText variant="small" numberOfLines={2}>
            {app.position}
          </AppText>
        </View>
      </View>
      {(app.location || showDeadline || app.salary) && (
        <View style={styles.cardMeta}>
          {app.location ? (
            <View style={styles.location}>
              <SymbolView name="mappin" size={11} tintColor={colors.fgFaint} />
              <AppText variant="small" numberOfLines={1} style={styles.shrink}>
                {app.location}
              </AppText>
            </View>
          ) : (
            <View style={styles.location} />
          )}
          {showDeadline ? <DueChip date={app.deadline} /> : app.salary ? <AppText variant="small">{app.salary}</AppText> : null}
        </View>
      )}
      {app.interviewStages.length > 0 && (
        <View style={styles.progressRow} accessibilityLabel={`${app.interviewStages.filter((s) => s.completed).length} of ${app.interviewStages.length} interview rounds done`}>
          <View style={styles.progress}>
            {app.interviewStages.map((stage) => (
              <View key={stage.id} style={[styles.progressBar, { backgroundColor: stage.completed ? palette.interviewing.mark : colors.mutedStrong }]} />
            ))}
          </View>
          <AppText variant="small">
            {app.interviewStages.filter((s) => s.completed).length}/{app.interviewStages.length}
          </AppText>
        </View>
      )}
    </PressableScale>
  );
}

/** Wishlist → Applied → Interviewing → Offer, with Closed shown where the application stopped. Same rules as the website. */
export function StageTrack({ app }: { app: Application }) {
  const { colors, status: palette } = useTheme();
  const steps: AppStatus[] = ["wishlist", "applied", "interviewing", "offer"];
  const closed = app.status === "rejected";
  const reached = closed ? (app.interviewStages.length > 0 ? 2 : app.appliedDate ? 1 : 0) : steps.indexOf(app.status);
  return (
    <View style={styles.track} accessibilityLabel={`Stage: ${STATUS[app.status].label}`}>
      {steps.map((s, i) => {
        const done = i <= reached;
        const current = i === reached;
        return (
          <View key={s} style={styles.trackStep}>
            <View style={[styles.trackBar, { backgroundColor: done ? (closed ? palette.rejected.mark : palette[app.status].mark) : colors.mutedStrong }]} />
            <AppText variant="small" numberOfLines={1} style={[current && { color: colors.fg, fontWeight: "600" }, !done && { color: colors.fgMuted }]}>
              {current && closed ? `${STATUS[s].label} · Closed` : STATUS[s].label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10, minHeight: 60 },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  rowMeta: { alignItems: "flex-end", gap: 4 },
  company: { fontWeight: "600" },
  card: { borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 3, borderCurve: "continuous", borderRadius: 12, padding: 12, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  location: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  progress: { flex: 1, flexDirection: "row", gap: 2 },
  progressBar: { flex: 1, height: 4, borderCurve: "continuous", borderRadius: 2 },
  track: { flexDirection: "row", gap: 6 },
  trackStep: { flex: 1, gap: 6, minWidth: 0 },
  trackBar: { height: 4, borderCurve: "continuous", borderRadius: 2 },
});
