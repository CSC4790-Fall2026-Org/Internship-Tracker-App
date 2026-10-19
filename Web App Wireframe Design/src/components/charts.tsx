import { useState } from "react";
import type { Application, AppStatus } from "../data/types";
import { STATUS, STATUS_ORDER } from "../data/status";
import { cx, StatusDot } from "./ui";

// ---------- Stage breakdown (part-to-whole + one tile per stage) ----------

export function StageBreakdown({ applications, onSelect }: { applications: Application[]; onSelect?: (status: AppStatus) => void }) {
  const [hover, setHover] = useState<AppStatus | null>(null);
  const total = applications.length;
  const rows = STATUS_ORDER.map((s) => ({ status: s, count: applications.filter((a) => a.status === s).length }));
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

  const segments = rows.filter((r) => r.count > 0).map((r) => ({ ...r, width: (r.count / total) * 100 }));

  return (
    <div>
      {/* Hovering a segment highlights its tile below, which already shows the count and share. */}
      <div>
        {/* 2px surface gaps separate the stages; the rounded ends belong to the whole bar. */}
        <div className="flex h-2 gap-[2px] overflow-hidden rounded-[4px]" role="img" aria-label={segments.map((r) => `${STATUS[r.status].label} ${r.count}`).join(", ")}>
          {segments.map((s) => (
            <div
              key={s.status}
              onPointerEnter={() => setHover(s.status)}
              onPointerLeave={() => setHover(null)}
              className="h-full transition-opacity duration-150"
              style={{ width: `${s.width}%`, background: STATUS[s.status].mark, opacity: hover && hover !== s.status ? 0.35 : 1 }}
            />
          ))}
        </div>
      </div>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-5 sm:gap-2">
        {rows.map((r) => (
          <li key={r.status} className="min-w-0">
            <button
              type="button"
              disabled={!onSelect}
              onClick={() => onSelect?.(r.status)}
              onPointerEnter={() => r.count && setHover(r.status)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => r.count && setHover(r.status)}
              onBlur={() => setHover(null)}
              aria-label={`${STATUS[r.status].label}: ${r.count} of ${total}. Show these applications`}
              className={cx(
                "flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-left sm:flex-col sm:items-start sm:justify-start sm:py-2 transition-[border-color,background-color] enabled:hover:border-line-strong enabled:hover:bg-subtle",
                hover === r.status ? "border-line-strong bg-subtle" : "border-line",
              )}
            >
              <span className="flex w-full min-w-0 items-center gap-1.5">
                <StatusDot status={r.status} />
                <span className="truncate text-xs text-fg-muted">{STATUS[r.status].label}</span>
              </span>
              <span className="flex items-baseline gap-1.5 sm:mt-1">
                <span className={cx("text-lg leading-tight font-semibold tabular-nums", r.count ? "text-fg" : "text-fg-muted")}>{r.count}</span>
                {r.count > 0 && <span className="text-2xs text-fg-muted tabular-nums">{pct(r.count)}%</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Conversion steps (ordinal: one hue, light → dark) ----------

const FUNNEL_RAMP = ["var(--color-funnel-1)", "var(--color-funnel-2)", "var(--color-funnel-3)", "var(--color-funnel-4)"];

/**
 * Each step is a subset of the one before it, so a step's rate is "of the previous step" and its bar is
 * "of the first step". Rates are only shown when the step before has at least one application.
 */
export function ConversionSteps({ steps }: { steps: { label: string; value: number }[] }) {
  const base = steps[0]?.value ?? 0;
  return (
    <ol className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
      {steps.map((step, i) => {
        const prev = i > 0 ? steps[i - 1] : null;
        const rate = prev && prev.value > 0 ? Math.round((step.value / prev.value) * 100) : null;
        return (
          <li key={step.label} className="min-w-0">
            <p className="truncate text-xs text-fg-muted">{step.label}</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg leading-tight font-semibold text-fg tabular-nums">{step.value}</span>
              {prev && (
                <span className="truncate text-2xs text-fg-muted tabular-nums" title={rate === null ? undefined : `${rate}% of ${prev.label.toLowerCase()}`}>
                  {rate === null ? "—" : `${rate}%`}
                  <span className="sr-only"> of {prev.label.toLowerCase()}</span>
                </span>
              )}
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-muted" aria-hidden="true">
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${base ? (step.value / base) * 100 : 0}%`, minWidth: step.value > 0 ? 6 : 0, background: FUNNEL_RAMP[i] }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ---------- Weekly submissions (single series, columns) ----------

/**
 * The hovered or focused week is read out in the header line rather than in a floating tip,
 * so it never covers neighbouring columns or the heading.
 */
export function WeeklyColumns({ weeks, title }: { weeks: { label: string; count: number }[]; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...weeks.map((w) => w.count));
  // Round the scale up to a clean tick so the top gridline lands on a whole number.
  const top = max <= 4 ? max : Math.ceil(max / 2) * 2;
  const H = 88;
  const total = weeks.reduce((n, w) => n + w.count, 0);
  const hovered = hover === null ? null : weeks[hover];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="text-xs font-semibold text-fg-2">{title}</h3>
        <p className="text-xs text-fg-muted tabular-nums" aria-live="polite">
          {hovered ? (
            <>
              <span className="font-semibold text-fg">{hovered.count}</span> {hovered.count === 1 ? "application" : "applications"} ·{" "}
              {hover === weeks.length - 1 ? "this week" : `week of ${hovered.label}`}
            </>
          ) : (
            `${total} in the last ${weeks.length} weeks`
          )}
        </p>
      </div>
      <div className="relative flex gap-2">
        <div className="flex w-4 flex-col justify-between text-right text-2xs text-fg-muted tabular-nums" style={{ height: H }}>
          <span className="-translate-y-1/2">{top}</span>
          <span className="translate-y-1/2">0</span>
        </div>
        <div className="relative flex-1" style={{ height: H }}>
          <div className="absolute inset-x-0 top-0 h-px bg-line/70" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-line" />
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
