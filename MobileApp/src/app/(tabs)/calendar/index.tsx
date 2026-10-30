import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useData } from "@shared/data/DataContext";
import { daysUntil, formatDate, formatTime, isoOf, relativeDay, toDate, todayISO } from "@shared/data/dates";
import { calendarItems, KIND_META, type CalendarItem } from "@shared/data/insights";
import { AppText, Banner, Button, Card, EmptyState, Screen, Segmented } from "@/components/ui";
import { HeaderButton } from "@/components/header-button";
import { KIND_ICON, KIND_ORDER } from "@/components/calendar-kinds";
import { PressableScale } from "@/components/pressable-scale";
import { useTheme } from "@/theme/use-theme";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Kept outside the component so coming back to the tab reopens the same view.
let lastView: "month" | "week" = "month";

/** The website's Calendar: deadlines, interview rounds, unfinished tasks and your own events, by month or week. */
export default function CalendarScreen() {
  const { applications, tasks, events, loading, error, refresh } = useData();
  const router = useRouter();
  const { colors, kind: kindColors } = useTheme();
  const today = todayISO();
  const [view, setViewState] = useState(lastView);
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState(today);
  const [refreshing, setRefreshing] = useState(false);

  const items = useMemo(() => calendarItems(applications, tasks, events), [applications, tasks, events]);
  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) map.set(item.date, [...(map.get(item.date) ?? []), item]);
    return map;
  }, [items]);
  // The selected day already has its own card, so leave it out here.
  const upcoming = items.filter((item) => item.date >= today && item.date !== selected).slice(0, 8);

  // Month grid, padded to whole weeks.
  const cells = useMemo(() => {
    const a = toDate(anchor);
    const year = a.getFullYear();
    const month = a.getMonth();
    const leading = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const count = Math.ceil((leading + daysInMonth) / 7) * 7;
    return Array.from({ length: count }, (_, i) => {
      const date = new Date(year, month, 1 - leading + i);
      return { iso: isoOf(date), day: date.getDate(), inMonth: date.getMonth() === month };
    });
  }, [anchor]);

  // The seven days of the week containing the anchor, Sunday first.
  const weekCells = useMemo(() => {
    const a = toDate(anchor);
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(a.getFullYear(), a.getMonth(), a.getDate() - a.getDay() + i);
      return { iso: isoOf(date), day: date.getDate() };
    });
  }, [anchor]);

  const setView = (v: typeof view) => {
    lastView = v;
    setViewState(v);
    setAnchor(selected);
  };
  const periodLabel = view === "month" ? toDate(anchor).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : weekRangeLabel(weekCells[0].iso, weekCells[6].iso);
  const shift = (delta: number) => {
    const d = toDate(anchor);
    setAnchor(isoOf(view === "month" ? new Date(d.getFullYear(), d.getMonth() + delta, 1) : new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta * 7)));
  };
  const selectDay = (iso: string) => {
    setSelected(iso);
    if (view === "month" && toDate(iso).getMonth() !== toDate(anchor).getMonth()) setAnchor(iso);
  };

  const addEvent = (date: string) => router.push({ pathname: "/calendar/event", params: { date } });
  const openItem = (item: CalendarItem) => {
    if (item.event) router.push({ pathname: "/calendar/event", params: { id: item.event.id } });
    else if (item.applicationId) router.push({ pathname: "/applications/[id]", params: { id: item.applicationId } });
  };

  const pullToRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const selectedItems = itemsByDate.get(selected) ?? [];
  const selectedTitle = relativeDay(selected) === "Today" || relativeDay(selected) === "Tomorrow" ? `${relativeDay(selected)} · ${formatDate(selected, { weekday: true })}` : formatDate(selected, { weekday: true, long: true });

  return (
    <>
      <Stack.Screen
        options={{
          headerLeft: () => <HeaderButton icon="magnifyingglass" label="Search" onPress={() => router.push("/search")} />,
          headerRight: () => (
            <View style={styles.headerButtons}>
              <HeaderButton icon="arrow.triangle.2.circlepath" label="Sync to your phone's calendar or Google Calendar" onPress={() => router.push("/calendar/sync")} />
              <HeaderButton icon="plus" label="Add event" onPress={() => addEvent(selected >= today ? selected : today)} />
            </View>
          ),
        }}
      />
      {loading ? (
        <View style={[styles.centered, { backgroundColor: colors.canvas }]}>
          <ActivityIndicator />
        </View>
      ) : (
        <Screen refreshing={refreshing} onRefresh={pullToRefresh}>
          {error && <Banner action={<Button onPress={refresh}>Try again</Button>}>{`Couldn't load your calendar: ${error}`}</Banner>}
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "month", label: "Month" },
              { value: "week", label: "Week" },
            ]}
          />

          <Card style={styles.calendarCard}>
            <View style={[styles.periodBar, { borderBottomColor: colors.line }]}>
              <HeaderButton icon="chevron.left" label={`Previous ${view}`} onPress={() => shift(-1)} />
              <AppText variant="heading" accessibilityLiveRegion="polite" style={styles.periodLabel}>
                {periodLabel}
              </AppText>
              <HeaderButton icon="chevron.right" label={`Next ${view}`} onPress={() => shift(1)} />
              <View style={styles.grow} />
              <HeaderButton
                label="Today"
                onPress={() => {
                  setAnchor(today);
                  setSelected(today);
                }}
              />
            </View>

            {view === "month" ? (
              <View>
                <View style={[styles.weekdays, { backgroundColor: colors.subtle, borderBottomColor: colors.line }]}>
                  {WEEKDAYS.map((day) => (
                    <AppText key={day} variant="small" maxFontSizeMultiplier={1.4} style={styles.weekday}>
                      {day[0]}
                    </AppText>
                  ))}
                </View>
                <View style={styles.grid}>
                  {cells.map((cell) => {
                    const dayItems = itemsByDate.get(cell.iso) ?? [];
                    const isToday = cell.iso === today;
                    const isSelected = cell.iso === selected;
                    return (
                      <Pressable
                        key={cell.iso}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={`${formatDate(cell.iso, { weekday: true, long: true })}${dayItems.length ? `, ${dayItems.length} item${dayItems.length === 1 ? "" : "s"}` : ""}`}
                        onPress={() => selectDay(cell.iso)}
                        onLongPress={() => addEvent(cell.iso)}
                        style={[styles.cell, !cell.inMonth && { backgroundColor: colors.subtle }]}
                      >
                        <View style={[styles.dayNumber, isToday ? { backgroundColor: colors.accent } : isSelected ? { backgroundColor: colors.ink } : null]}>
                          <AppText maxFontSizeMultiplier={1.2} style={[styles.dayText, { color: isToday ? "#FFFFFF" : isSelected ? colors.onInk : cell.inMonth ? colors.fg2 : colors.fgMuted }, (isToday || isSelected) && styles.bold]}>
                            {cell.day}
                          </AppText>
                        </View>
                        <View style={styles.dots}>
                          {dayItems.slice(0, 3).map((item) => (
                            <View key={item.id} style={[styles.dot, { backgroundColor: kindColors[item.kind] }]} />
                          ))}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : (
              <View>
                {weekCells.map((cell, i) => {
                  const dayItems = itemsByDate.get(cell.iso) ?? [];
                  const isToday = cell.iso === today;
                  return (
                    <Pressable
                      key={cell.iso}
                      onPress={() => selectDay(cell.iso)}
                      onLongPress={() => addEvent(cell.iso)}
                      style={[styles.weekRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }, cell.iso === selected && { backgroundColor: colors.accentSoft }]}
                    >
                      <View style={styles.weekDay}>
                        <AppText variant="small">{WEEKDAYS[i]}</AppText>
                        <View style={[styles.dayNumber, isToday && { backgroundColor: colors.accent }]}>
                          <AppText maxFontSizeMultiplier={1.2} style={[styles.bold, { color: isToday ? "#FFFFFF" : colors.fg }]}>
                            {cell.day}
                          </AppText>
                        </View>
                      </View>
                      <View style={styles.weekItems}>
                        {dayItems.length === 0 ? (
                          <AppText variant="small">Nothing</AppText>
                        ) : (
                          dayItems.map((item) => <ItemChip key={item.id} item={item} onPress={() => openItem(item)} />)
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Card>

          <View style={styles.legend} accessibilityLabel="Legend">
            {KIND_ORDER.map((kind) => (
              <View key={kind} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: kindColors[kind] }]} />
                <AppText variant="small">{KIND_META[kind].label}</AppText>
              </View>
            ))}
          </View>

          <Card>
            <View style={styles.cardHeader}>
              <View style={styles.grow}>
                <AppText variant="heading">{selectedTitle}</AppText>
                {selectedItems.length > 0 && <AppText variant="small">{`${selectedItems.length} item${selectedItems.length === 1 ? "" : "s"}`}</AppText>}
              </View>
              <HeaderButton icon="plus.circle" label="Add event on this day" onPress={() => addEvent(selected)} />
            </View>
            {selectedItems.length === 0 ? <AppText variant="muted">Nothing on this day.</AppText> : selectedItems.map((item) => <AgendaRow key={item.id} item={item} onPress={() => openItem(item)} />)}
          </Card>

          <Card>
            <AppText variant="heading">Coming up</AppText>
            {upcoming.length === 0 ? (
              <EmptyState icon="calendar" title="Nothing scheduled" description="Touch and hold any day, or use + to add an event.">
                <Button onPress={() => addEvent(today)} style={styles.topGap}>
                  Add event
                </Button>
              </EmptyState>
            ) : (
              upcoming.map((item) => <AgendaRow key={item.id} item={item} onPress={() => openItem(item)} showDate />)
            )}
          </Card>
        </Screen>
      )}
    </>
  );
}

/** One item in the week view, tinted by its kind like the website's calendar chips. */
function ItemChip({ item, onPress }: { item: CalendarItem; onPress: () => void }) {
  const { colors, kind: kindColors } = useTheme();
  return (
    <PressableScale feel="soft" accessibilityRole="button" accessibilityLabel={`${KIND_META[item.kind].label}: ${item.label}`} onPress={onPress} style={[styles.chip, { backgroundColor: colors.subtle, borderLeftColor: kindColors[item.kind] }]}>
      <AppText numberOfLines={1} style={styles.chipText}>
        {item.time ? `${formatTime(item.time)}  ` : ""}
        {item.label}
      </AppText>
    </PressableScale>
  );
}

function AgendaRow({ item, onPress, showDate }: { item: CalendarItem; onPress: () => void; showDate?: boolean }) {
  const { colors, kind: kindColors } = useTheme();
  const days = daysUntil(item.date);
  const clickable = !!item.event || !!item.applicationId;
  return (
    <PressableScale feel="soft" accessibilityRole={clickable ? "button" : undefined} disabled={!clickable} onPress={onPress} style={({ pressed }) => [styles.agendaRow, pressed && { backgroundColor: colors.subtle }]}>
      <SymbolView name={KIND_ICON[item.kind]} size={15} tintColor={kindColors[item.kind]} />
      <View style={styles.grow}>
        <AppText numberOfLines={1}>{item.label}</AppText>
        <AppText variant="small" numberOfLines={1}>
          {showDate ? `${days === 0 ? "Today" : days === 1 ? "Tomorrow" : formatDate(item.date, { weekday: true })} · ` : ""}
          {item.time ? formatTime(item.time) : KIND_META[item.kind].label}
          {item.detail && item.kind !== "event" ? ` · ${item.detail}` : ""}
        </AppText>
      </View>
      {clickable && <SymbolView name="chevron.right" size={12} tintColor={colors.fgFaint} />}
    </PressableScale>
  );
}

/** "Sep 20 – 26, 2026", widening to months or years only when the week spans them. Same as the website. */
function weekRangeLabel(startIso: string, endIso: string) {
  const start = toDate(startIso);
  const end = toDate(endIso);
  const year = end.getFullYear();
  const md = (d: Date, withYear = false) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: withYear ? "numeric" : undefined });
  if (start.getFullYear() !== year) return `${md(start, true)} – ${md(end, true)}`;
  if (start.getMonth() !== end.getMonth()) return `${md(start)} – ${md(end)}, ${year}`;
  return `${md(start)} – ${end.getDate()}, ${year}`;
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerButtons: { flexDirection: "row", alignItems: "center", gap: 12 },
  grow: { flex: 1, minWidth: 0 },
  bold: { fontWeight: "600" },
  topGap: { marginTop: 8 },
  calendarCard: { padding: 0, gap: 0, overflow: "hidden" },
  periodBar: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  periodLabel: { marginLeft: 4 },
  weekdays: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  weekday: { width: `${100 / 7}%`, textAlign: "center", paddingVertical: 6, fontWeight: "500" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, alignItems: "center", paddingTop: 6, paddingBottom: 8, minHeight: 56, gap: 4 },
  dayNumber: { width: 30, height: 30, borderCurve: "continuous", borderRadius: 15, alignItems: "center", justifyContent: "center" },
  dayText: { fontSize: 15, fontVariant: ["tabular-nums"] },
  dots: { flexDirection: "row", gap: 3, height: 6 },
  dot: { width: 6, height: 6, borderCurve: "continuous", borderRadius: 3 },
  weekRow: { flexDirection: "row", gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  weekDay: { width: 44, alignItems: "center", gap: 2 },
  weekItems: { flex: 1, gap: 6, justifyContent: "center" },
  chip: { borderLeftWidth: 3, borderCurve: "continuous", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 },
  chipText: { fontSize: 14, fontWeight: "500" },
  legend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 16, marginTop: -4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  agendaRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, borderCurve: "continuous", borderRadius: 8 },
});
