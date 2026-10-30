// Phone versions of the website's components/charts.tsx and SankeyDiagram.tsx: same data, same colors.
// Hover becomes tap: tapping a week or a flow reads out its number, tapping again clears it.
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Svg, { G, Path, Rect, Text as SvgText } from "react-native-svg";
import type { Application, AppStatus } from "@shared/data/types";
import { STATUS, STATUS_ORDER } from "@shared/data/status";
import { isSubmitted, reachedInterview } from "@shared/data/insights";
import { AppText, StatusDot } from "@/components/ui";
import { geistFamily } from "@/components/text";
import { GrowBar } from "@/components/motion";
import { useTheme } from "@/theme/use-theme";

// ---------- Stage breakdown (part-to-whole bar + a row per stage) ----------

export function StageBreakdown({ applications, onSelect, grow = false }: { applications: Application[]; onSelect?: (status: AppStatus) => void; grow?: boolean }) {
  const { colors, status: palette } = useTheme();
  const total = applications.length;
  const rows = STATUS_ORDER.map((s) => ({ status: s, count: applications.filter((a) => a.status === s).length }));
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

  return (
    <View style={styles.gap12}>
      <GrowBar grow={grow} style={[styles.stackBar, { backgroundColor: colors.muted }]}>
        <View style={styles.stackBarInner} accessibilityRole="image" accessibilityLabel={rows.map((r) => `${STATUS[r.status].label} ${r.count}`).join(", ")}>
        {rows
          .filter((r) => r.count > 0)
          .map((r) => (
              <View key={r.status} style={{ flex: r.count, backgroundColor: palette[r.status].mark }} />
            ))}
        </View>
      </GrowBar>
      <View style={[styles.tiles, { borderColor: colors.line }]}>
        {rows.map((r, i) => (
          <Pressable
            key={r.status}
            accessibilityRole="button"
            accessibilityLabel={`${STATUS[r.status].label}: ${r.count} of ${total}. Show these applications`}
            disabled={!onSelect}
            onPress={() => onSelect?.(r.status)}
            style={({ pressed }) => [styles.tile, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }, pressed && { backgroundColor: colors.subtle }]}
          >
            <StatusDot status={r.status} />
            <AppText variant="muted" style={styles.grow}>
              {STATUS[r.status].label}
            </AppText>
            <AppText style={[styles.tileCount, !r.count && { color: colors.fgMuted }]}>{r.count}</AppText>
            <AppText variant="small" style={styles.tilePct}>
              {r.count > 0 ? `${pct(r.count)}%` : ""}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ---------- Conversion steps (one hue, light → dark) ----------

/** Each step is a subset of the one before, so a step's rate is "of the previous step" and its bar is "of the first step". */
export function ConversionSteps({ steps, grow = false }: { steps: { label: string; value: number }[]; grow?: boolean }) {
  const { colors, funnel } = useTheme();
  const base = steps[0]?.value ?? 0;
  return (
    <View style={styles.steps}>
      {steps.map((step, i) => {
        const prev = i > 0 ? steps[i - 1] : null;
        const rate = prev && prev.value > 0 ? Math.round((step.value / prev.value) * 100) : null;
        return (
          <View key={step.label} style={styles.step} accessibilityLabel={`${step.label}: ${step.value}${prev ? (rate === null ? "" : `, ${rate}% of ${prev.label.toLowerCase()}`) : ""}`}>
            <AppText variant="small">{step.label}</AppText>
            <View style={styles.stepNumbers}>
              <AppText style={styles.stepValue}>{step.value}</AppText>
              {prev && <AppText variant="small">{rate === null ? "—" : `${rate}%`}</AppText>}
            </View>
            <View style={[styles.meter, { backgroundColor: colors.muted }]}>
              <GrowBar grow={grow} delayMs={200 + i * 70} style={[styles.meterFill, { width: `${base ? (step.value / base) * 100 : 0}%`, minWidth: step.value > 0 ? 6 : 0, backgroundColor: funnel[i] }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ---------- Weekly submissions ----------

export function WeeklyColumns({ weeks, title }: { weeks: { label: string; count: number }[]; title: string }) {
  const { colors, status: palette } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(1, ...weeks.map((w) => w.count));
  // Round the scale up to a clean tick so the top gridline lands on a whole number.
  const top = max <= 4 ? max : Math.ceil(max / 2) * 2;
  const H = 96;
  const total = weeks.reduce((n, w) => n + w.count, 0);
  const picked = selected === null ? null : weeks[selected];

  return (
    <View>
      <View style={styles.weeklyHeader}>
        <AppText variant="small" style={styles.bold}>
          {title}
        </AppText>
        <AppText variant="small" accessibilityLiveRegion="polite">
          {picked ? `${picked.count} ${picked.count === 1 ? "application" : "applications"} · ${selected === weeks.length - 1 ? "this week" : `week of ${picked.label}`}` : `${total} in the last ${weeks.length} weeks`}
        </AppText>
      </View>
      <View style={styles.weeklyBody}>
        <View style={[styles.axis, { height: H }]}>
          <AppText variant="small">{top}</AppText>
          <AppText variant="small">0</AppText>
        </View>
        <View style={[styles.plot, { height: H, borderTopColor: colors.line, borderBottomColor: colors.lineStrong }]}>
          {weeks.map((w, i) => (
            <Pressable
              key={w.label}
              accessibilityRole="button"
              accessibilityLabel={`Week of ${w.label}: ${w.count}`}
              onPress={() => setSelected(selected === i ? null : i)}
              style={styles.column}
            >
              <View
                style={{
                  width: "100%",
                  maxWidth: 22,
                  height: w.count === 0 ? 2 : `${(w.count / top) * 100}%`,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  backgroundColor: w.count === 0 ? colors.line : palette.applied.mark,
                  opacity: selected !== null && selected !== i ? 0.45 : 1,
                }}
              />
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.weeklyLabels}>
        <AppText variant="small">{weeks[0]?.label}</AppText>
        <AppText variant="small">{weeks[Math.floor(weeks.length / 2)]?.label}</AppText>
        <AppText variant="small">This week</AppText>
      </View>
    </View>
  );
}

// ---------- Sankey: where every application has ended up ----------

interface SNode {
  id: string;
  label: string;
  count: number;
  col: number;
  color: string;
}

interface SLink {
  source: string;
  target: string;
  value: number;
}

// Same model as the website: every count is a filter over real applications.
function buildModel(applications: Application[], color: (status: AppStatus | "total") => string) {
  const submitted = applications.filter(isSubmitted);
  const interviewed = submitted.filter(reachedInterview);
  const notInterviewed = submitted.filter((a) => !reachedInterview(a));
  const n = (list: Application[], pred: (a: Application) => boolean) => list.filter(pred).length;

  const nodes: SNode[] = [
    { id: "total", label: "All tracked", count: applications.length, col: 0, color: color("total") },
    { id: "submitted", label: "Submitted", count: submitted.length, col: 1, color: color("applied") },
    { id: "wishlist", label: "Not applied yet", count: applications.length - submitted.length, col: 1, color: color("wishlist") },
    { id: "interviewed", label: "Interviewed", count: interviewed.length, col: 2, color: color("interviewing") },
    { id: "awaiting", label: "Awaiting reply", count: n(notInterviewed, (a) => a.status === "applied"), col: 2, color: color("applied") },
    { id: "rejected", label: "Rejected", count: n(notInterviewed, (a) => a.status === "rejected"), col: 2, color: color("rejected") },
    { id: "offer", label: "Offer", count: n(interviewed, (a) => a.status === "offer"), col: 3, color: color("offer") },
    { id: "in_progress", label: "Still interviewing", count: n(interviewed, (a) => a.status === "interviewing" || a.status === "applied"), col: 3, color: color("interviewing") },
    { id: "no_offer", label: "Didn't advance", count: n(interviewed, (a) => a.status === "rejected"), col: 3, color: color("rejected") },
  ];
  const count = (id: string) => nodes.find((x) => x.id === id)!.count;
  const links: SLink[] = [
    { source: "total", target: "submitted", value: count("submitted") },
    { source: "total", target: "wishlist", value: count("wishlist") },
    { source: "submitted", target: "interviewed", value: count("interviewed") },
    { source: "submitted", target: "awaiting", value: count("awaiting") },
    { source: "submitted", target: "rejected", value: count("rejected") },
    { source: "interviewed", target: "offer", value: count("offer") },
    { source: "interviewed", target: "in_progress", value: count("in_progress") },
    { source: "interviewed", target: "no_offer", value: count("no_offer") },
  ].filter((l) => l.value > 0);
  return { total: applications.length, nodes: nodes.filter((x) => x.count > 0), links };
}

const W = 880;
const H = 340;
const NODE_W = 10;
const GAP = 16;
const PAD_Y = 28;
const COL_X = [20, 250, 480, 710];
// Drawn at a fixed width and scrolled sideways on a phone, so labels stay readable.
const DRAWN_WIDTH = 640;

type Placed = SNode & { x: number; y: number; h: number };

function layout(nodes: SNode[], links: SLink[], total: number) {
  // One scale for every column, so a column's height shows how many applications reached it.
  const unit = total === 0 ? 0 : (H - PAD_Y * 2 - GAP * 2) / total;
  const placed: Record<string, Placed> = {};
  for (let col = 0; col < COL_X.length; col++) {
    let y = PAD_Y;
    for (const node of nodes.filter((x) => x.col === col)) {
      const h = Math.max(node.count * unit, 3);
      placed[node.id] = { ...node, x: COL_X[col], y, h };
      y += h + GAP;
    }
  }
  const outUsed: Record<string, number> = {};
  const inUsed: Record<string, number> = {};
  const paths = links.map((link) => {
    const s = placed[link.source];
    const t = placed[link.target];
    const thick = Math.max(link.value * unit, 1.5);
    const sy = s.y + (outUsed[s.id] ?? 0);
    const ty = t.y + (inUsed[t.id] ?? 0);
    outUsed[s.id] = (outUsed[s.id] ?? 0) + thick;
    inUsed[t.id] = (inUsed[t.id] ?? 0) + thick;
    const x0 = s.x + NODE_W;
    const x1 = t.x;
    const cx = (x0 + x1) / 2;
    return {
      key: `${link.source}-${link.target}`,
      link,
      color: t.color,
      d: `M ${x0} ${sy} C ${cx} ${sy}, ${cx} ${ty}, ${x1} ${ty} L ${x1} ${ty + thick} C ${cx} ${ty + thick}, ${cx} ${sy + thick}, ${x0} ${sy + thick} Z`,
    };
  });
  return { placed, paths };
}

export function SankeyDiagram({ applications }: { applications: Application[] }) {
  const { colors, status: palette } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const { total, nodes, links } = buildModel(applications, (s) => (s === "total" ? colors.fg2 : palette[s].mark));
  const { placed, paths } = layout(nodes, links, total);
  const select = (key: string) => setSelected(selected === key ? null : key);

  const path = paths.find((p) => p.key === selected);
  const node = selected ? placed[selected] : undefined;
  const readout = path
    ? `${path.link.value} · ${placed[path.link.source].label} → ${placed[path.link.target].label} · ${Math.round((path.link.value / placed[path.link.source].count) * 100)}%`
    : node
      ? `${node.count} · ${node.label} · ${Math.round((node.count / total) * 100)}% of all`
      : "Tap a flow or a bar for its numbers.";

  const touches = (key: string) => {
    if (!selected || selected === key) return true;
    const [s, t] = key.split("-");
    return selected === s || selected === t;
  };

  return (
    <View style={styles.gap12}>
      <AppText variant="small" accessibilityLiveRegion="polite" style={selected ? [styles.bold, { color: colors.fg }] : undefined}>
        {readout}
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ width: DRAWN_WIDTH }}>
          <Svg width={DRAWN_WIDTH} height={(DRAWN_WIDTH * H) / W} viewBox={`0 0 ${W} ${H}`} accessibilityLabel={nodes.map((x) => `${x.label}: ${x.count}`).join(", ")}>
            {paths.map((p) => (
              <Path key={p.key} d={p.d} fill={p.color} opacity={touches(p.key) ? (selected ? 0.42 : 0.2) : 0.06} onPress={() => select(p.key)} />
            ))}
            {Object.values(placed).map((n) => {
              const dim = !!selected && selected !== n.id && !paths.some((p) => p.key === selected && (p.link.source === n.id || p.link.target === n.id));
              const lx = n.x + NODE_W + 8;
              return (
                <G key={n.id} opacity={dim ? 0.45 : 1} onPress={() => select(n.id)}>
                  <Rect x={n.x - 8} y={n.y - 4} width={NODE_W + 16} height={n.h + 8} fill="transparent" />
                  <Rect x={n.x} y={n.y} width={NODE_W} height={n.h} rx={3} fill={n.color} />
                  <HaloText x={lx} y={n.y + 14} size={17} weight="600" color={colors.fg} halo={colors.surface}>
                    {String(n.count)}
                  </HaloText>
                  <HaloText x={lx} y={n.y + 32} size={14} color={colors.fgMuted} halo={colors.surface}>
                    {n.label}
                  </HaloText>
                </G>
              );
            })}
          </Svg>
          <View style={styles.sankeyColumns}>
            {["Tracked", "Applied?", "First response", "Outcome"].map((label, i) => (
              <AppText key={label} variant="small" style={[styles.sankeyColumn, { left: (COL_X[i] / W) * DRAWN_WIDTH }]}>
                {label}
              </AppText>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/** A label with a background-colored outline so it stays legible over the flows. Drawn twice, as react-native-svg has no paint-order. */
function HaloText({ x, y, size, weight, color, halo, children }: { x: number; y: number; size: number; weight?: "600"; color: string; halo: string; children: string }) {
  return (
    <>
      <SvgText x={x} y={y} fontSize={size} fontFamily={geistFamily(weight)} fill={halo} stroke={halo} strokeWidth={4} strokeLinejoin="round">
        {children}
      </SvgText>
      <SvgText x={x} y={y} fontSize={size} fontFamily={geistFamily(weight)} fill={color}>
        {children}
      </SvgText>
    </>
  );
}

const styles = StyleSheet.create({
  gap12: { gap: 12 },
  grow: { flex: 1 },
  bold: { fontWeight: "600" },
  stackBar: { height: 8, borderCurve: "continuous", borderRadius: 4, overflow: "hidden" },
  stackBarInner: { flex: 1, flexDirection: "row", gap: 2 },
  tiles: { borderWidth: StyleSheet.hairlineWidth, borderCurve: "continuous", borderRadius: 10, overflow: "hidden" },
  tile: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, paddingHorizontal: 12 },
  tileCount: { fontSize: 17, lineHeight: 22, fontWeight: "600", fontVariant: ["tabular-nums"] },
  tilePct: { width: 40, textAlign: "right", fontVariant: ["tabular-nums"] },
  steps: { flexDirection: "row", flexWrap: "wrap", rowGap: 16 },
  step: { width: "50%", paddingRight: 16, gap: 4 },
  stepNumbers: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  stepValue: { fontSize: 18, lineHeight: 24, fontWeight: "600", fontVariant: ["tabular-nums"] },
  meter: { height: 6, borderCurve: "continuous", borderRadius: 3, overflow: "hidden", marginTop: 4 },
  meterFill: { height: "100%", borderCurve: "continuous", borderRadius: 3 },
  weeklyHeader: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8, marginBottom: 12 },
  weeklyBody: { flexDirection: "row", gap: 8 },
  axis: { width: 20, justifyContent: "space-between", alignItems: "flex-end" },
  plot: { flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 2, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: 1 },
  column: { flex: 1, height: "100%", justifyContent: "flex-end", alignItems: "center" },
  weeklyLabels: { flexDirection: "row", justifyContent: "space-between", paddingLeft: 28, marginTop: 6 },
  sankeyColumns: { height: 18, marginTop: 4 },
  sankeyColumn: { position: "absolute", fontWeight: "500" },
});
