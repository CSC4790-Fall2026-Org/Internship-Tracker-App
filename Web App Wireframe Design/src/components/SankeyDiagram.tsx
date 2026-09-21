import { useState } from "react";
import type { Application } from "../data/types";

// ── Data model ────────────────────────────────────────────────────────────────

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
  const count = (statuses: string[]) => applications.filter((a) => statuses.includes(a.status)).length;
  const total = applications.length;
  const applied = count(["applied", "interviewing", "offer", "rejected"]);
  const noResponse = count(["wishlist"]);
  const interviewed = count(["interviewing", "offer"]);
  const directRejected = count(["rejected"]);
  const pendingReview = count(["applied"]);
  const offers = count(["offer"]);
  const noOffer = count(["interviewing"]);

  const nodes: SNode[] = [
    { id: "total",        label: "Applications",  count: total,          col: 0, color: "#2563EB" },
    { id: "screening",    label: "Screening",      count: applied,        col: 1, color: "#7C3AED" },
    { id: "no_response",  label: "No Response",    count: noResponse,     col: 1, color: "#94A3B8" },
    { id: "interviewing", label: "Interviewing",   count: interviewed,    col: 2, color: "#D97706" },
    { id: "rejected",     label: "Rejected",       count: directRejected, col: 2, color: "#EF4444" },
    { id: "pending",      label: "Pending",        count: pendingReview,  col: 2, color: "#64748B" },
    { id: "offer",        label: "Offers",         count: offers,         col: 3, color: "#059669" },
    { id: "no_offer",     label: "No Offer",       count: noOffer,        col: 3, color: "#DC2626" },
  ];

  const links: SLink[] = [
    { source: "total",        target: "screening",    value: applied       },
    { source: "total",        target: "no_response",  value: noResponse    },
    { source: "screening",    target: "interviewing", value: interviewed   },
    { source: "screening",    target: "rejected",     value: directRejected},
    { source: "screening",    target: "pending",      value: pendingReview },
    { source: "interviewing", target: "offer",        value: offers        },
    { source: "interviewing", target: "no_offer",     value: noOffer       },
  ];

  return { total, nodes, links };
}

// ── Layout ────────────────────────────────────────────────────────────────────

const SVG_W = 860;
const SVG_H = 380;
const NODE_W = 14;
const COL_GAP = 20;           // vertical gap between nodes in same column
const COLS = 4;
const COL_X = [60, 260, 460, 660]; // x positions per column
const PADDING_TOP = 40;
const USABLE_H = SVG_H - PADDING_TOP * 2;

function layoutNodes(nodes: SNode[]) {
  const result: Record<string, { x: number; y: number; h: number; color: string; label: string; count: number }> = {};

  for (let col = 0; col < COLS; col++) {
    const colNodes = nodes.filter((n) => n.col === col);
    const colTotal = colNodes.reduce((s, n) => s + n.count, 0);
    if (colTotal === 0) continue;

    const totalGap = COL_GAP * (colNodes.length - 1);
    const barH = USABLE_H - totalGap;

    let curY = PADDING_TOP;
    for (const node of colNodes) {
      const h = node.count > 0 ? (node.count / colTotal) * barH : 0;
      result[node.id] = { x: COL_X[col], y: curY, h, color: node.color, label: node.label, count: node.count };
      curY += h + (node.count > 0 ? COL_GAP : 0);
    }
  }
  return result;
}

// Track how much of each node's height has been "used" for outgoing/incoming flows
function buildLinkPaths(
  nodes: SNode[],
  links: SLink[],
  layout: ReturnType<typeof layoutNodes>
) {
  const sourceUsed: Record<string, number> = {};
  const targetUsed: Record<string, number> = {};

  // Sort links by target Y so flows are visually ordered
  const sorted = [...links].sort((a, b) => {
    const ay = layout[a.target]?.y ?? 0;
    const by = layout[b.target]?.y ?? 0;
    return ay - by;
  });

  return sorted.map((link) => {
    const src = layout[link.source];
    const tgt = layout[link.target];
    if (!src || !tgt || link.value === 0) return null;

    const srcTotal = nodes.find((n) => n.id === link.source)!.count;
    const tgtTotal = nodes.find((n) => n.id === link.target)!.count;

    const linkH_src = (link.value / srcTotal) * src.h;
    const linkH_tgt = (link.value / tgtTotal) * tgt.h;

    const sy0 = src.y + (sourceUsed[link.source] ?? 0);
    const sy1 = sy0 + linkH_src;
    const ty0 = tgt.y + (targetUsed[link.target] ?? 0);
    const ty1 = ty0 + linkH_tgt;

    sourceUsed[link.source] = (sourceUsed[link.source] ?? 0) + linkH_src;
    targetUsed[link.target] = (targetUsed[link.target] ?? 0) + linkH_tgt;

    const x0 = src.x + NODE_W;
    const x1 = tgt.x;
    const cx = (x0 + x1) / 2;

    const path = `
      M ${x0} ${sy0}
      C ${cx} ${sy0}, ${cx} ${ty0}, ${x1} ${ty0}
      L ${x1} ${ty1}
      C ${cx} ${ty1}, ${cx} ${sy1}, ${x0} ${sy1}
      Z
    `;

    const srcNode = nodes.find((n) => n.id === link.source)!;

    return { path, color: srcNode.color, source: link.source, target: link.target, value: link.value };
  }).filter(Boolean);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SankeyDiagram({ applications }: { applications: Application[] }) {
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const { total, nodes, links } = buildModel(applications);
  const layout = layoutNodes(nodes);
  const linkPaths = buildLinkPaths(nodes, links, layout);

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "24px 28px",
      }}
    >
      <div className="flex items-end justify-between mb-1">
        <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.9375rem", color: "var(--foreground)" }}>
          Application Flow
        </h3>
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
          {total} total applications
        </span>
      </div>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--muted-foreground)", marginBottom: "20px" }}>
        How applications move through each stage
      </p>

      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width="100%"
        style={{ overflow: "visible", display: "block" }}
      >
        {/* Link paths */}
        {linkPaths.map((lp, i) => {
          if (!lp) return null;
          const key = `${lp.source}-${lp.target}`;
          const isHov = hoveredLink === key;
          return (
            <path
              key={i}
              d={lp.path}
              fill={lp.color}
              opacity={hoveredLink ? (isHov ? 0.45 : 0.08) : 0.18}
              style={{ transition: "opacity 0.2s", cursor: "default" }}
              onMouseEnter={() => setHoveredLink(key)}
              onMouseLeave={() => setHoveredLink(null)}
            />
          );
        })}

        {/* Node rectangles + labels */}
        {nodes.map((node) => {
          const n = layout[node.id];
          if (!n || n.h === 0) return null;
          const isHov = hoveredNode === node.id;
          const labelOnRight = node.col < 3;

          return (
            <g
              key={node.id}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: "default" }}
            >
              {/* Bar */}
              <rect
                x={n.x}
                y={n.y}
                width={NODE_W}
                height={n.h}
                rx={3}
                fill={n.color}
                opacity={hoveredNode ? (isHov ? 1 : 0.4) : 0.85}
                style={{ transition: "opacity 0.15s" }}
              />

              {/* Count above bar */}
              <text
                x={labelOnRight ? n.x + NODE_W + 10 : n.x - 10}
                y={n.y - 7}
                textAnchor={labelOnRight ? "start" : "end"}
                fontFamily="var(--font-heading)"
                fontSize="15"
                fontWeight="700"
                fill={isHov ? n.color : "var(--foreground)"}
                style={{ transition: "fill 0.15s" }}
              >
                {n.count}
              </text>

              {/* Label below count */}
              <text
                x={labelOnRight ? n.x + NODE_W + 10 : n.x - 10}
                y={n.y + 9}
                textAnchor={labelOnRight ? "start" : "end"}
                fontFamily="var(--font-body)"
                fontSize="11"
                fill="var(--muted-foreground)"
              >
                {n.label}
              </text>

              {/* Percentage */}
              {total > 0 && (
                <text
                  x={labelOnRight ? n.x + NODE_W + 10 : n.x - 10}
                  y={n.y + 22}
                  textAnchor={labelOnRight ? "start" : "end"}
                  fontFamily="var(--font-mono-base)"
                  fontSize="10"
                  fill={n.color}
                  opacity={0.75}
                >
                  {Math.round((n.count / total) * 100)}%
                </text>
              )}
            </g>
          );
        })}

        {/* Column labels */}
        {[
          { x: COL_X[0] + NODE_W / 2, label: "Total" },
          { x: COL_X[1] + NODE_W / 2, label: "Response" },
          { x: COL_X[2] + NODE_W / 2, label: "Stage" },
          { x: COL_X[3] + NODE_W / 2, label: "Outcome" },
        ].map((col) => (
          <text
            key={col.label}
            x={col.x}
            y={SVG_H - 8}
            textAnchor="middle"
            fontFamily="var(--font-body)"
            fontSize="10"
            fill="var(--muted-foreground)"
            opacity={0.6}
            letterSpacing="0.06em"
          >
            {col.label.toUpperCase()}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "16px", paddingTop: "14px", borderTop: "1px solid var(--border)" }}>
        {nodes.filter((n) => n.id !== "total").map((node) => (
          <div key={node.id} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: node.color, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
              {node.label}
            </span>
            <span style={{ fontFamily: "var(--font-mono-base)", fontSize: "0.6875rem", color: node.color, fontWeight: 600 }}>
              {node.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
