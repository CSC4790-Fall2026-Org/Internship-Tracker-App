import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

/*
 * One motion vocabulary for the whole app. CSS owns most of it (tokens and keyframes in index.css);
 * this module holds the same values for the few things that need JavaScript: rows leaving a list,
 * cards travelling between Board columns, and numbers counting up.
 *
 * Springs are expressed as CSS `linear()` curves sampled from a damped spring, so they work in
 * transitions, keyframes and the Web Animations API alike:
 *   SPRING  ζ = 0.80, ~1.5% overshoot — things that travel (cards, the segmented pill, row height)
 *   SNAPPY  ζ = 0.86, ~0.5% overshoot — presses and bars, where any wobble would read as jitter
 * Keep in sync with --ease-spring / --ease-snappy in index.css.
 */
export const SPRING =
  "linear(0, 0.0467, 0.1557, 0.2919, 0.4324, 0.5634, 0.6775, 0.772, 0.8469, 0.9039, 0.9455, 0.9746, 0.9938, 1.0056, 1.012, 1.0147, 1.0151, 1.014, 1.0121, 1.01, 1.0079, 1.006, 1.0044, 1.003, 1)";
export const EASE_OUT = "cubic-bezier(0.2, 0.9, 0.3, 1)";

export const DURATION = {
  /** Presses, hovers, colour changes. */
  fast: 140,
  /** Overlays, fades, row collapse. */
  base: 220,
  /** Things that travel across the layout. */
  travel: 340,
  /** Numbers and bars settling into their values on first load. */
  settle: 600,
} as const;

export function prefersReducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

const springSupported = typeof CSS !== "undefined" && CSS.supports?.("transition-timing-function", "linear(0, 1)");
/** The spring curve where the browser supports `linear()`, a close cubic-bezier otherwise. */
export const springEasing = springSupported ? SPRING : EASE_OUT;

// ---------- First visit ----------

const played = new Set<string>();

/**
 * True the first time `key` mounts in this page session, false afterwards. Entrance choreography uses it
 * so returning to a screen is instant rather than replaying the same animation every time.
 */
export function useFirstVisit(key: string) {
  const [first] = useState(() => !played.has(key) && !prefersReducedMotion());
  useEffect(() => {
    played.add(key);
  }, [key]);
  return first;
}

/** False on the first paint, true from the next frame: lets bars and meters transition in from zero. */
export function useMountedFrame(enabled = true) {
  const [ready, setReady] = useState(!enabled);
  // Mount-only: `enabled` is read once, so a later re-render with a different value can't strand it at false.
  useEffect(() => {
    if (ready) return;
    let raf = requestAnimationFrame(() => (raf = requestAnimationFrame(() => setReady(true))));
    return () => cancelAnimationFrame(raf);
  }, []);
  return ready;
}

/** True for the first `ms` after mount when `enabled`: entrance-only delays use it, so later updates aren't held back. */
export function useEntering(enabled: boolean, ms = 1200) {
  const [entering, setEntering] = useState(enabled);
  useEffect(() => {
    if (!entering) return;
    const timer = setTimeout(() => setEntering(false), ms);
    return () => clearTimeout(timer);
  }, []);
  return entering;
}

// ---------- Count up ----------

/**
 * Tweens from 0 to `value` once, on first visit only; later changes swap instantly (the caller marks them
 * with a short CSS "value-in" instead). Render the real value for assistive tech separately.
 */
export function useCountUp(value: number, enabled: boolean, delayMs = 0) {
  const [shown, setShown] = useState(enabled ? 0 : value);
  // Marked only once the tween completes, so an interrupted run (React StrictMode re-running effects) starts over.
  const done = useRef(!enabled);
  useEffect(() => {
    if (done.current) {
      setShown(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, now - start - delayMs) / DURATION.settle);
      const eased = 1 - Math.pow(1 - t, 4);
      setShown(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else done.current = true;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
}

// ---------- Presence: let removed rows animate out ----------

export type PresenceState = "present" | "entering" | "exiting";

/**
 * Renders `items` plus any that were just removed, held in their old position while they animate out.
 * Removed items are dropped after `exitMs`; items that appear after the first render are marked "entering".
 * Nothing waits on this: the data has already changed, only its picture lingers briefly.
 */
export function usePresence<T>(items: T[], keyOf: (item: T) => string, exitMs = 380, enterMs = 300) {
  const [, force] = useState(0);
  const rendered = useRef<{ key: string; item: T; state: PresenceState }[]>(items.map((item) => ({ key: keyOf(item), item, state: "present" })));
  const timers = useRef(new Map<string, { state: PresenceState; timer: ReturnType<typeof setTimeout> }>());
  const mounted = useRef(false);
  const reduce = prefersReducedMotion();

  const prev = rendered.current;
  const prevByKey = new Map(prev.map((r) => [r.key, r]));
  // The live list, in its current order.
  const next: typeof prev = items.map((item) => {
    const key = keyOf(item);
    const was = prevByKey.get(key);
    const state: PresenceState = was ? (was.state === "exiting" ? "entering" : was.state) : mounted.current && !reduce ? "entering" : "present";
    return { key, item, state };
  });
  // Removed rows go back in right after the nearest row that preceded them and is still here.
  if (!reduce) {
    const liveKeys = new Set(next.map((r) => r.key));
    prev.forEach((p, idx) => {
      if (liveKeys.has(p.key)) return;
      let at = 0;
      for (let j = idx - 1; j >= 0; j--) {
        const pos = next.findIndex((n) => n.key === prev[j].key);
        if (pos >= 0) {
          at = pos + 1;
          break;
        }
      }
      next.splice(at, 0, { ...p, state: "exiting" });
    });
  }
  rendered.current = next;

  useEffect(() => {
    mounted.current = true;
    for (const r of rendered.current) {
      const pending = timers.current.get(r.key);
      if (pending?.state === r.state) continue;
      // State changed (or settled): drop the stale timer, e.g. a row that came back via Undo mid-exit.
      if (pending) {
        clearTimeout(pending.timer);
        timers.current.delete(r.key);
      }
      if (r.state === "present") continue;
      const settle =
        r.state === "exiting"
          ? (list: typeof rendered.current) => list.filter((x) => !(x.key === r.key && x.state === "exiting"))
          : // Once grown in, it's an ordinary row again (no clipping, so focus rings show in full).
            (list: typeof rendered.current) => list.map((x) => (x.key === r.key && x.state === "entering" ? { ...x, state: "present" as const } : x));
      timers.current.set(r.key, {
        state: r.state,
        timer: setTimeout(
          () => {
            timers.current.delete(r.key);
            rendered.current = settle(rendered.current);
            force((n) => n + 1);
          },
          r.state === "exiting" ? exitMs : enterMs,
        ),
      });
    }
  });
  useEffect(
    () => () => {
      timers.current.forEach((t) => clearTimeout(t.timer));
      timers.current.clear();
    },
    [],
  );

  return next;
}

// ---------- FLIP: glide elements to their new place ----------

/**
 * After every commit, any `[data-flip]` element inside `container` that moved since the previous commit
 * glides from its old position to its new one. An element can be given an explicit starting rect
 * (e.g. where a dragged card was dropped) through `startAt`. Transforms only, so layout never waits.
 */
export function useFlip(container: RefObject<HTMLElement | null>, startAt?: RefObject<Map<string, { left: number; top: number }>>) {
  const last = useRef(new Map<string, { left: number; top: number }>());
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const reduce = prefersReducedMotion();
    const next = new Map<string, { left: number; top: number }>();
    for (const el of root.querySelectorAll<HTMLElement>("[data-flip]")) {
      const key = el.dataset.flip!;
      const visual = el.getBoundingClientRect();
      // Strip any in-flight translate so we compare true layout positions.
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform === "none" ? undefined : getComputedStyle(el).transform);
      const layout = { left: visual.left - m.e, top: visual.top - m.f };
      next.set(key, layout);
      const from = startAt?.current?.get(key) ?? last.current.get(key);
      startAt?.current?.delete(key);
      if (!from || reduce) continue;
      const dx = from.left - layout.left;
      const dy = from.top - layout.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      el.getAnimations().forEach((a) => a.id === "flip" && a.cancel());
      const anim = el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: DURATION.travel, easing: springEasing });
      anim.id = "flip";
    }
    last.current = next;
  });
}
