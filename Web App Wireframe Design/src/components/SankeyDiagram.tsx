import { useState } from "react";
import type { Application } from "../data/types";
import { isSubmitted, reachedInterview } from "../data/insights";
import { Card, CardHeader } from "./ui";

// ── Data model ────────────────────────────────────────────────────────────────
// Every count is a filter over real applications. Status is current state only, so a closed
// application counts as "interviewed" when it has interview rounds logged.

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

function buildModel(applications: Application[]) {
  const submitted = applications.filter(isSubmitted);
  const interviewed = submitted.filter(reachedInterview);
  const notInterviewed = submitted.filter((a) => !reachedInterview(a));
  const n = (list: Application[], pred: (a: Application) => boolean) => list.filter(pred).length;

  const nodes: SNode[] = [
    { id: "total", label: "All tracked", count: applications.length, col: 0, color: "var(--color-fg-2)" },
    { id: "submitted", label: "Submitted", count: submitted.length, col: 1, color: "var(--color-status-applied)" },
    { id: "wishlist", label: "Not applied yet", count: applications.length - submitted.length, col: 1, color: "var(--color-status-wishlist)" },
    { id: "interviewed", label: "Interviewed", count: interviewed.length, col: 2, color: "var(--color-status-interviewing)" },
    { id: "awaiting", label: "Awaiting reply", count: n(notInterviewed, (a) => a.status === "applied"), col: 2, color: "var(--color-status-applied)" },
    { id: "rejected", label: "Rejected", count: n(notInterviewed, (a) => a.status === "rejected"), col: 2, color: "var(--color-status-rejected)" },
    { id: "offer", label: "Offer", count: n(interviewed, (a) => a.status === "offer"), col: 3, color: "var(--color-status-offer)" },
    { id: "in_progress", label: "Still interviewing", count: n(interviewed, (a) => a.status === "interviewing" || a.status === "applied"), col: 3, color: "var(--color-status-interviewing)" },
    { id: "no_offer", label: "Didn't advance", count: n(interviewed, (a) => a.status === "rejected"), col: 3, color: "var(--color-status-rejected)" },
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

// ── Layout ────────────────────────────────────────────────────────────────────

const W = 880;
const H = 340;
const NODE_W = 10;
const GAP = 16;
const PAD_Y = 28;
const COL_X = [20, 250, 480, 710];

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
      mid: { x: cx, y: (sy + ty) / 2 + thick / 2 },
      d: `M ${x0} ${sy} C ${cx} ${sy}, ${cx} ${ty}, ${x1} ${ty} L ${x1} ${ty + thick} C ${cx} ${ty + thick}, ${cx} ${sy + thick}, ${x0} ${sy + thick} Z`,
    };
  });
  return { placed, paths };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SankeyDiagram({ applications }: { applications: Application[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const { total, nodes, links } = buildModel(applications);
  const { placed, paths } = layout(nodes, links, total);
  const nodeLabel = (id: string) => placed[id]?.label ?? id;

  const hoveredPath = paths.find((p) => p.key === hover);
  const hoveredNode = hover && placed[hover];
  const tip = hoveredPath
    ? {
        x: hoveredPath.mid.x,
        y: hoveredPath.mid.y,
        value: hoveredPath.link.value,
        text: `${nodeLabel(hoveredPath.link.source)} → ${nodeLabel(hoveredPath.link.target)} · ${Math.round((hoveredPath.link.value / placed[hoveredPath.link.source].count) * 100)}%`,
      }
    : hoveredNode
      ? { x: hoveredNode.x + NODE_W / 2, y: hoveredNode.y, value: hoveredNode.count, text: `${hoveredNode.label} · ${Math.round((hoveredNode.count / total) * 100)}% of all` }
      : null;

  const linkTouches = (key: string) => {
    if (!hover) return true;
    if (hover === key) return true;
    const [s, t] = key.split("-");
    return hover === s || hover === t;
  };

  return (
    <Card>
      <CardHeader title="Application flow" description="Where each application you've tracked has ended up so far. Hover a flow for its conversion." />
      <div className="overflow-x-auto px-4 pb-4">
        <div className="relative min-w-[640px]">
          {tip && (
            <div
              role="tooltip"
              className="pointer-events-none absolute z-10 rounded-md bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-pop"
              style={{ left: `${(tip.x / W) * 100}%`, top: `${(tip.y / H) * 100}%`, transform: "translate(-50%, calc(-100% - 8px))" }}
            >
              <span className="font-semibold tabular-nums">{tip.value}</span> <span className="text-white/70">{tip.text}</span>
            </div>
          )}
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={nodes.map((x) => `${x.label}: ${x.count}`).join(", ")} className="block overflow-visible">
            {paths.map((p) => (
              <path
                key={p.key}
                d={p.d}
                fill={p.color}
                opacity={linkTouches(p.key) ? (hover ? 0.42 : 0.2) : 0.06}
                className="transition-opacity duration-150"
                onPointerEnter={() => setHover(p.key)}
                onPointerLeave={() => setHover(null)}
              />
            ))}
            {Object.values(placed).map((node) => {
              // Labels sit right of every bar; the last column leaves room for them inside the viewBox.
              const lx = node.x + NODE_W + 8;
              const dim = hover && hover !== node.id && !paths.some((p) => p.key === hover && (p.link.source === node.id || p.link.target === node.id));
              return (
                <g key={node.id} onPointerEnter={() => setHover(node.id)} onPointerLeave={() => setHover(null)} opacity={dim ? 0.45 : 1} className="transition-opacity duration-150">
                  <rect x={node.x} y={node.y} width={NODE_W} height={node.h} rx={3} fill={node.color} />
                  {/* Transparent hit area wider than the 10px bar */}
                  <rect x={node.x - 8} y={node.y - 4} width={NODE_W + 16} height={node.h + 8} fill="transparent" />
                  <text x={lx} y={node.y + 12} fontSize="15" fontWeight="600" fill="var(--color-fg)" stroke="var(--color-surface)" strokeWidth="4" paintOrder="stroke" className="tabular-nums">
                    {node.count}
                  </text>
                  <text x={lx} y={node.y + 27} fontSize="12" fill="var(--color-fg-muted)" stroke="var(--color-surface)" strokeWidth="4" paintOrder="stroke">
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="relative mt-2 h-4 text-2xs font-medium text-fg-muted">
            {["Tracked", "Applied?", "First response", "Outcome"].map((label, i) => (
              <span key={label} className="absolute" style={{ left: `${(COL_X[i] / W) * 100}%` }}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
