import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import type { Application, AppStatus } from "@shared/data/types";
import { useData } from "@shared/data/DataContext";
import { STATUS, STATUS_ORDER } from "@shared/data/status";
import { csvToApplications } from "@shared/data/csv";
import { roleKey } from "@shared/data/jobs";
import { AppText, Banner, Button, Card, Chip, EmptyState, Screen, Segmented } from "@/components/ui";
import { ApplicationRow } from "@/components/applications";
import { Board } from "@/components/board";
import { Insights } from "@/components/insights";
import { HeaderButton } from "@/components/header-button";
import { HeaderMenu, TextMenu, type MenuEntry } from "@/components/native-menu";
import { SwipeRow } from "@/components/swipe-row";
import { chooseAction, confirm, errorMessage, useToast } from "@/components/feedback";
import { useChangeStatus } from "@/data/use-change-status";
import { pickCsv, shareApplicationsCsv } from "@/data/csv-files";
import { matchesSearch, sortApplications, SORT_LABEL, type SortField } from "@/data/sort-applications";
import { useTheme } from "@/theme/use-theme";
import Animated, { LayoutAnimationConfig } from "react-native-reanimated";
import { ROW_ENTER, ROW_EXIT, ROW_LAYOUT } from "@/theme/motion";

type ViewMode = "list" | "board" | "insights";

// Kept outside the component so coming back to the tab reopens the same view, like the website's Board.
let lastView: ViewMode = "list";

const asStatus = (value: string | undefined) => (STATUS_ORDER.includes(value as AppStatus) ? (value as AppStatus) : null);

export default function ApplicationsScreen() {
  const { applications, loading, error, refresh, deleteApplications, importApplications } = useData();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { changeStatus, pickStatus } = useChangeStatus();
  // Set by the dashboard: a stage to filter the list by, or the Board view.
  const params = useLocalSearchParams<{ status?: string; view?: string }>();

  const [view, setViewState] = useState<ViewMode>(params.view === "board" ? "board" : asStatus(params.status) ? "list" : lastView);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AppStatus | "all">(asStatus(params.status) ?? "all");
  const [sortField, setSortField] = useState<SortField>("deadline");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const setView = (v: ViewMode) => {
    lastView = v;
    setViewState(v);
    setSelecting(false);
  };

  // The tab stays mounted, so a later tap on a dashboard tile arrives as new params rather than a new screen.
  const [seenParams, setSeenParams] = useState(params);
  if (params.status !== seenParams.status || params.view !== seenParams.view) {
    setSeenParams(params);
    if (params.view === "board") setViewState("board");
    else if (asStatus(params.status)) {
      setViewState("list");
      setFilter(asStatus(params.status)!);
    }
  }

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<AppStatus, number>;
    for (const a of applications) c[a.status] += 1;
    return c;
  }, [applications]);

  const filtered = useMemo(
    () => sortApplications(applications.filter((a) => (filter === "all" || a.status === filter) && matchesSearch(a, search)), sortField, sortDir),
    [applications, filter, search, sortField, sortDir],
  );

  // Selection only counts rows you can see, so filtering never acts on hidden applications.
  const visibleSelected = filtered.filter((a) => selectedIds.has(a.id));
  const allSelected = filtered.length > 0 && visibleSelected.length === filtered.length;

  const open = (app: Application) => router.push({ pathname: "/applications/[id]", params: { id: app.id } });
  const add = (status?: AppStatus) => router.push({ pathname: "/applications/form", params: status ? { status } : {} });

  const pullToRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const toggleRow = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const stopSelecting = () => {
    setSelecting(false);
    setSelectedIds(new Set());
  };

  const deleteMany = async (apps: Application[]) => {
    const n = apps.length;
    const ok = await confirm({
      title: n === 1 ? `Delete ${apps[0].company} · ${apps[0].position}?` : `Delete ${n} applications?`,
      message: `${n === 1 ? "Its" : "Their"} interview stages are deleted too, and linked contacts are unlinked. This can't be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteApplications(apps.map((a) => a.id));
      stopSelecting();
      toast(n === 1 ? `Deleted ${apps[0].company}` : `Deleted ${n} applications`);
    } catch (e) {
      toast(`Couldn't delete: ${errorMessage(e)}`, { tone: "error" });
    }
  };

  const moveSelected = () =>
    chooseAction(
      `Move ${visibleSelected.length} to…`,
      STATUS_ORDER.map((status) => ({
        label: STATUS[status].label,
        onPress: async () => {
          const targets = visibleSelected.filter((a) => a.status !== status);
          if (targets.length === 0) return;
          await Promise.all(targets.map((a) => changeStatus(a, status)));
          stopSelecting();
        },
      })),
    );

  const hasFilters = filter !== "all" || search.trim() !== "";

  // Exports the selection if there is one, otherwise whatever the current filters show. Same rule as the website.
  const exportCsv = async () => {
    const rows = selecting && visibleSelected.length > 0 ? visibleSelected : filtered;
    try {
      await shareApplicationsCsv(rows);
    } catch (e) {
      toast(`Couldn't export: ${errorMessage(e)}`, { tone: "error" });
    }
  };

  // Same checks as the website: rows without a company or position are skipped, and so are roles already tracked.
  const importCsv = async () => {
    let picked: { name: string; text: string } | null;
    try {
      picked = await pickCsv();
    } catch (e) {
      toast(`Couldn't read that file: ${errorMessage(e)}`, { tone: "error" });
      return;
    }
    if (!picked) return;
    const { rows, skipped, ignoredColumns } = csvToApplications(picked.text);
    const existing = new Set(applications.map((a) => roleKey(a.company, a.position)));
    const seen = new Set<string>();
    const fresh = rows.filter((r) => {
      const key = roleKey(r.company, r.position);
      if (existing.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const duplicates = rows.length - fresh.length;
    const details = [
      skipped > 0 && `${skipped} row${skipped === 1 ? "" : "s"} skipped (missing company or position)`,
      duplicates > 0 && `${duplicates} already tracked, skipped`,
      ignoredColumns.length > 0 && `Columns not imported: ${ignoredColumns.join(", ")}`,
    ].filter(Boolean) as string[];
    const detailText = details.length > 0 ? `\n\n${details.map((d) => `• ${d}`).join("\n")}` : "";

    if (fresh.length === 0) {
      Alert.alert("Nothing new to import", `No new applications were found in ${picked.name}. The file needs a header row with at least Company and Position columns.${detailText}`);
      return;
    }
    const ok = await confirm({ title: `Import ${fresh.length} application${fresh.length === 1 ? "" : "s"}?`, message: `From ${picked.name}.${detailText}`, confirmLabel: "Import" });
    if (!ok) return;
    try {
      await importApplications(fresh);
      toast(`Imported ${fresh.length} application${fresh.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast(`Couldn't import: ${errorMessage(e)}`, { tone: "error" });
    }
  };

  const moreMenuItems: MenuEntry[] = [
    { label: "Import CSV", icon: "square.and.arrow.down", onPress: importCsv },
    ...(filtered.length > 0 ? [{ label: hasFilters ? `Export ${filtered.length} shown as CSV` : "Export all as CSV", icon: "square.and.arrow.up" as const, onPress: exportCsv }] : []),
  ];

  const rowActions = (app: Application) =>
    chooseAction(`${app.company} · ${app.position}`, [
      { label: "Open", onPress: () => open(app) },
      { label: "Move to…", onPress: () => pickStatus(app) },
      { label: "Edit details", onPress: () => router.push({ pathname: "/applications/form", params: { id: app.id } }) },
      { label: "Delete application", destructive: true, onPress: () => deleteMany([app]) },
    ]);

  // Picking the current field again flips the direction, as on the website's column headers.
  const sortItems: MenuEntry[] = [
    ...(Object.keys(SORT_LABEL) as SortField[]).map((field) => ({
      label: SORT_LABEL[field],
      checked: field === sortField,
      onPress: () => {
        if (field === sortField) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
          setSortField(field);
          setSortDir("asc");
        }
      },
    })),
    "divider",
    { label: sortDir === "asc" ? "Reverse order (↓)" : "Reverse order (↑)", icon: "arrow.up.arrow.down", onPress: () => setSortDir((d) => (d === "asc" ? "desc" : "asc")) },
  ];

  const listMode = view === "list" && applications.length > 0;

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: listMode
            ? { placeholder: "Search company, role, location, notes", hideWhenScrolling: false, onChangeText: (e) => setSearch(e.nativeEvent.text), onCancelButtonPress: () => setSearch("") }
            : undefined,
          headerRight: () => (
            <View style={styles.headerButtons}>
              {listMode && <HeaderButton label={selecting ? "Done" : "Select"} bold={selecting} onPress={() => (selecting ? stopSelecting() : setSelecting(true))} />}
              {!selecting && <HeaderMenu label="Import or export" items={moreMenuItems} />}
              {!selecting && <HeaderButton icon="plus" label="Add application" onPress={() => add()} />}
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
          {error && <Banner action={<Button onPress={refresh}>Try again</Button>}>{`Couldn't load your applications: ${error}`}</Banner>}

          {applications.length > 0 && (
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: "list", label: "List" },
                { value: "board", label: "Board" },
                { value: "insights", label: "Insights" },
              ]}
            />
          )}

          {applications.length === 0 ? (
            <Card>
              <EmptyState icon="list.bullet" title="No applications yet" description="Add the roles you're interested in. Anything you add on the website shows up here too.">
                <Button variant="primary" onPress={() => add()} style={styles.emptyButton}>
                  Add application
                </Button>
                <Button onPress={importCsv}>Import CSV</Button>
              </EmptyState>
            </Card>
          ) : view === "board" ? (
            <Board applications={applications} onOpen={open} onAdd={add} onMove={pickStatus} />
          ) : view === "insights" ? (
            <Insights applications={applications} />
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityLabel="Filter by stage">
                <Chip label={`All  ${applications.length}`} active={filter === "all"} onPress={() => setFilter("all")} />
                {STATUS_ORDER.map((s) => (
                  <Chip key={s} label={`${STATUS[s].label}  ${counts[s]}`} active={filter === s} onPress={() => setFilter(s)} />
                ))}
              </ScrollView>

              <View style={styles.listHeader}>
                <AppText variant="small">
                  {hasFilters ? `${filtered.length} of ${applications.length}` : `${applications.length}`} application{applications.length === 1 ? "" : "s"}
                  {filter !== "all" ? ` · ${STATUS[filter].label}` : ""}
                </AppText>
                <TextMenu label={`Sort: ${SORT_LABEL[sortField]} ${sortDir === "asc" ? "↑" : "↓"}`} items={sortItems} />
              </View>

              {selecting && (
                <Card style={[styles.bulk, { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }]}>
                  <View style={styles.bulkTop}>
                    <AppText style={styles.bold}>{visibleSelected.length} selected</AppText>
                    <HeaderButton
                      label={allSelected ? "Deselect all" : "Select all"}
                      onPress={() => setSelectedIds(allSelected ? new Set() : new Set(filtered.map((a) => a.id)))}
                    />
                  </View>
                  <View style={styles.bulkActions}>
                    <Button onPress={moveSelected} disabled={visibleSelected.length === 0} style={styles.grow}>
                      Move to…
                    </Button>
                    <Button onPress={exportCsv} disabled={visibleSelected.length === 0} style={styles.grow}>
                      Export
                    </Button>
                    <Button variant="danger-ghost" onPress={() => deleteMany(visibleSelected)} disabled={visibleSelected.length === 0} style={styles.grow}>
                      Delete
                    </Button>
                  </View>
                </Card>
              )}

              {filtered.length === 0 ? (
                <Card>
                  <EmptyState
                    icon="magnifyingglass"
                    title="No applications match"
                    description={
                      search
                        ? `Nothing matches “${search}”${filter !== "all" ? ` in ${STATUS[filter].label}` : ""}.`
                        : `You don't have any ${filter !== "all" ? STATUS[filter].label.toLowerCase() : ""} applications.`
                    }
                  >
                    {filter !== "all" && (
                      <Button onPress={() => setFilter("all")} style={styles.emptyButton}>
                        Show all stages
                      </Button>
                    )}
                  </EmptyState>
                </Card>
              ) : (
                <Card style={styles.list}>
                  <LayoutAnimationConfig skipEntering>
                  {filtered.map((app, i) => (
                    <Animated.View key={app.id} layout={ROW_LAYOUT} entering={ROW_ENTER} exiting={ROW_EXIT} style={i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }}>
                      <SwipeRow
                        enabled={!selecting}
                        leading={[{ label: "Move", icon: "arrow.right.circle", color: colors.accent, onPress: () => pickStatus(app) }]}
                        trailing={[{ label: "Delete", icon: "trash", color: colors.danger, onPress: () => deleteMany([app]) }]}
                      >
                      <ApplicationRow
                        app={app}
                        onPress={() => open(app)}
                        onLongPress={() => rowActions(app)}
                        selecting={selecting}
                        selected={selectedIds.has(app.id)}
                        onToggleSelect={() => toggleRow(app.id)}
                      />
                      </SwipeRow>
                    </Animated.View>
                  ))}
                  </LayoutAnimationConfig>
                </Card>
              )}
            </>
          )}
        </Screen>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerButtons: { flexDirection: "row", alignItems: "center", gap: 12 },
  filters: { gap: 8, paddingRight: 16 },
  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: -8 },
  list: { padding: 0, gap: 0, overflow: "hidden" },
  bulk: { gap: 10 },
  bulkTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bulkActions: { flexDirection: "row", gap: 8 },
  bold: { fontWeight: "600" },
  grow: { flex: 1 },
  emptyButton: { marginTop: 8 },
});
