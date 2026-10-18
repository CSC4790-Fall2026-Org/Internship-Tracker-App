import { useState, type ReactNode } from "react";
import type { Application, AppStatus } from "../data/types";
import { STATUS, STATUS_ORDER } from "../data/status";
import { cx, StatusDot } from "./ui";

/** Small hover/focus readout anchored above a mark. Values lead, labels follow. */
function Tip({ x, children, align = "center" }: { x: number; children: ReactNode; align?: "center" | "start" | "end" }) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute bottom-full z-20 mb-2 rounded-md bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-pop"
      style={{ left: `${x}%`, transform: align === "center" ? "translateX(-50%)" : align === "end" ? "translateX(-100%)" : undefined }}
    >
      {children}
    </div>
  );
}

// ---------- Status distribution (part-to-whole) ----------

export function StatusDistribution({ applications, onSelect }: { applications: Application[]; onSelect?: (status: AppStatus) => void }) {
  const [hover, setHover] = useState<AppStatus | null>(null);
  const total = applications.length;
  const rows = STATUS_ORDER.map((s) => ({ status: s, count: applications.filter((a) => a.status === s).length }));
  const present = rows.filter((r) => r.count > 0);

  let offset = 0;
  const segments = present.map((r) => {
    const start = offset;
    offset += (r.count / total) * 100;
    return { ...r, start, width: (r.count / total) * 100 };
  });
  const hovered = segments.find((s) => s.status === hover);

  return (
    <div>
      <div className="relative">
        {hovered && (
          <Tip x={hovered.start + hovered.width / 2}>
            <span className="font-semibold tabular-nums">{hovered.count}</span> <span className="text-white/70">{STATUS[hovered.status].label} · {Math.round((hovered.count / total) * 100)}%</span>
          </Tip>
        )}
        {/* 2px surface gaps separate the stages; the rounded ends belong to the whole bar. */}
        <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-[4px]" role="img" aria-label={present.map((r) => `${STATUS[r.status].label} ${r.count}`).join(", ")}>
          {segments.map((s) => (
            <div
              key={s.status}
              onPointerEnter={() => setHover(s.status)}
              onPointerLeave={() => setHover(null)}
              className="h-full transition-opacity duration-150"
              style={{ width: `${s.width}%`, background: STATUS[s.status].mark, opacity: hover && hover !== s.status ? 0.45 : 1 }}
            />
          ))}
        </div>
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-1">
        {rows.map((r) => (
          <li key={r.status}>
            <button
              type="button"
              disabled={!onSelect}
              onClick={() => onSelect?.(r.status)}
              onPointerEnter={() => r.count && setHover(r.status)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => r.count && setHover(r.status)}
              onBlur={() => setHover(null)}
              className="-mx-1.5 flex items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors enabled:hover:bg-muted"
            >
              <StatusDot status={r.status} />
              <span className="text-ui text-fg-muted">{STATUS[r.status].label}</span>
              <span className="text-ui font-medium text-fg tabular-nums">{r.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Conversion funnel (ordinal: one hue, light → dark) ----------

const FUNNEL_RAMP = ["#86B6EF", "#5598E7", "#256ABF", "#104281"];

export function ConversionFunnel({ steps }: { steps: { label: string; value: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const base = steps[0]?.value ?? 0;
  return (
    <ol className="space-y-2.5">
      {steps.map((step, i) => {
        const width = base === 0 ? 0 : (step.value / base) * 100;
        const prev = i > 0 ? steps[i - 1] : null;
        const stepRate = prev && prev.value > 0 ? Math.round((step.value / prev.value) * 100) : null;
        return (
          <li
            key={step.label}
            tabIndex={0}
            aria-label={`${step.label}: ${step.value}${base ? `, ${Math.round((step.value / base) * 100)}% of submitted` : ""}`}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            className="relative rounded-md outline-offset-4"
          >
            {hover === i && prev && stepRate !== null && (
              <Tip x={Math.max(8, Math.min(width, 92))}>
                <span className="font-semibold tabular-nums">{stepRate}%</span> <span className="text-white/70">of {prev.label.toLowerCase()} → {step.label.toLowerCase()}</span>
              </Tip>
            )}
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="text-fg-muted">{step.label}</span>
              <span className="tabular-nums">
                <span className="font-medium text-fg">{step.value}</span>
                {i > 0 && base > 0 && <span className="ml-1.5 text-fg-muted">{Math.round((step.value / base) * 100)}%</span>}
              </span>
            </div>
            <div className="h-2 rounded-[4px] bg-muted">
              <div className="h-full rounded-[4px] transition-[width] duration-500" style={{ width: `${width}%`, minWidth: step.value > 0 ? 4 : 0, background: FUNNEL_RAMP[i] }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ---------- Weekly submissions (single series, columns) ----------

export function WeeklyColumns({ weeks }: { weeks: { label: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...weeks.map((w) => w.count));
  // Round the scale up to a clean tick so the top gridline lands on a whole number.
  const top = max <= 4 ? max : Math.ceil(max / 2) * 2;
  const H = 88;

  return (
    <div>
      <div className="relative flex gap-2">
        <div className="flex w-4 flex-col justify-between text-right text-2xs text-fg-muted tabular-nums" style={{ height: H }}>
          <span className="-translate-y-1/2">{top}</span>
          <span className="translate-y-1/2">0</span>
        </div>
        <div className="relative flex-1" style={{ height: H }}>
          <div className="absolute inset-x-0 top-0 h-px bg-line/70" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-line" />
          {hover !== null && (
            <Tip x={((hover + 0.5) / weeks.length) * 100} align={hover < 2 ? "start" : hover > weeks.length - 3 ? "end" : "center"}>
              <span className="font-semibold tabular-nums">{weeks[hover].count}</span>{" "}
              <span className="text-white/70">
                {weeks[hover].count === 1 ? "application" : "applications"} · {hover === weeks.length - 1 ? "this week" : `week of ${weeks[hover].label}`}
              </span>
            </Tip>
          )}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {weeks.map((w, i) => (
              <div
                key={w.label}
                tabIndex={0}
                aria-label={`Week of ${w.label}: ${w.count}`}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="flex h-full flex-1 items-end justify-center rounded-sm outline-offset-0"
              >
                <div
                  className={cx("w-full max-w-6 rounded-t-[4px] transition-opacity", hover !== null && hover !== i && "opacity-50")}
                  style={{ height: w.count === 0 ? 2 : `${(w.count / top) * 100}%`, background: w.count === 0 ? "var(--color-line)" : "var(--color-status-applied)" }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-1.5 flex justify-between pl-6 text-2xs text-fg-muted">
        <span>{weeks[0]?.label}</span>
        <span>{weeks[Math.floor(weeks.length / 2)]?.label}</span>
        <span>This week</span>
      </div>
    </div>
  );
}
