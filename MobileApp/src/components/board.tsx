import { useMemo } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import type { Application, AppStatus } from "@shared/data/types";
import { STATUS, STATUS_ORDER } from "@shared/data/status";
import { AppText, StatusDot } from "@/components/ui";
import { BoardCard } from "@/components/applications";
import { HeaderButton } from "@/components/header-button";
import { useTheme } from "@/theme/use-theme";

const GAP = 10;

/**
 * The website's Board, one stage per column, swiped sideways a column at a time. Cards move with touch and hold
 * → "Move to…" for now; dragging between columns is a later step in DEVELOPMENT_PLAN.md.
 */
export function Board({ applications, onOpen, onAdd, onMove }: { applications: Application[]; onOpen: (app: Application) => void; onAdd: (status: AppStatus) => void; onMove: (app: Application) => void }) {
  const { colors, status: palette } = useTheme();
  const { width } = useWindowDimensions();
  // Wide enough to read a card, narrow enough that the next column peeks in as a hint to swipe.
  const columnWidth = Math.min(320, width * 0.8);

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(STATUS_ORDER.map((s) => [s, [] as Application[]])) as Record<AppStatus, Application[]>;
    // Soonest deadline first within a column; undated cards after. Same as the website.
    for (const a of [...applications].sort((x, y) => (x.deadline || "9999").localeCompare(y.deadline || "9999"))) map[a.status].push(a);
    return map;
  }, [applications]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={columnWidth + GAP}
      decelerationRate="fast"
      contentContainerStyle={styles.board}
      // Lets the board run to the screen edges past the page padding.
      style={styles.bleed}
    >
      {STATUS_ORDER.map((status) => {
        const cards = byStatus[status];
        return (
          <View key={status} accessibilityLabel={`${STATUS[status].label}, ${cards.length}`} style={[styles.column, { width: columnWidth, backgroundColor: palette[status].soft }]}>
            <View style={styles.columnHeader}>
              <StatusDot status={status} />
              <AppText style={styles.columnTitle}>{STATUS[status].label}</AppText>
              <View style={[styles.count, { backgroundColor: colors.surface }]}>
                <AppText variant="small" style={[styles.countText, { color: palette[status].fg }]}>
                  {cards.length}
                </AppText>
              </View>
              <View style={styles.grow} />
              <HeaderButton icon="plus" label={`Add to ${STATUS[status].label}`} onPress={() => onAdd(status)} />
            </View>
            {cards.map((app) => (
              <BoardCard key={app.id} app={app} onPress={() => onOpen(app)} onLongPress={() => onMove(app)} />
            ))}
            {cards.length === 0 && (
              <View style={[styles.emptyColumn, { borderColor: colors.lineStrong }]}>
                <AppText variant="small" style={styles.center}>
                  {STATUS[status].hint}
                </AppText>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -16 },
  board: { paddingHorizontal: 16, gap: GAP, alignItems: "flex-start" },
  column: { borderCurve: "continuous", borderRadius: 12, padding: 8, gap: 8, minHeight: 360 },
  columnHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 6, minHeight: 36 },
  columnTitle: { fontWeight: "600" },
  count: { borderCurve: "continuous", borderRadius: 999, paddingHorizontal: 7, minWidth: 22, alignItems: "center" },
  countText: { fontWeight: "600" },
  grow: { flex: 1 },
  emptyColumn: { borderWidth: 1, borderStyle: "dashed", borderCurve: "continuous", borderRadius: 8, paddingVertical: 28, paddingHorizontal: 12 },
  center: { textAlign: "center" },
});
