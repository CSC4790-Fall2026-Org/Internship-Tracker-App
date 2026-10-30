// Mirrors the color tokens in the website's src/index.css (light under @theme, dark under [data-theme='dark']).
// Keep the two in sync so both apps look like one product.
import type { AppStatus } from "@shared/data/types";
import type { ItemKind } from "@shared/data/insights";

export const Colors = {
  light: {
    canvas: "#F7F7F8",
    surface: "#FFFFFF",
    subtle: "#FAFAFB",
    muted: "#F3F3F5",
    mutedStrong: "#E9E9EC",
    line: "#E6E6EA",
    lineStrong: "#D5D5DB",
    fg: "#18181B",
    fg2: "#3F3F46",
    fgMuted: "#6E6E78",
    fgFaint: "#A1A1AA",
    ink: "#18181B",
    onInk: "#FFFFFF",
    accent: "#4B57D6",
    accentSoft: "#EEF0FC",
    accentFg: "#3742AE",
    danger: "#DC2626",
    dangerSoft: "#FEF2F2",
    dangerFg: "#B91C1C",
    dangerLine: "#F8D3D3",
    warning: "#D97706",
    warningSoft: "#FFF8EB",
    warningFg: "#9A4D06",
    success: "#12996A",
    successSoft: "#EAF7F1",
    successFg: "#0B7A53",
  },
  dark: {
    canvas: "#0E0E10",
    surface: "#17171A",
    subtle: "#1B1B1F",
    muted: "#222227",
    mutedStrong: "#2B2B31",
    line: "#29292F",
    lineStrong: "#393941",
    fg: "#EDEDEF",
    fg2: "#C6C6CD",
    fgMuted: "#8E8E99",
    fgFaint: "#5F5F69",
    ink: "#EDEDEF",
    onInk: "#17171A",
    accent: "#7C86F2",
    accentSoft: "#1E2140",
    accentFg: "#ADB3F8",
    danger: "#E5484D",
    dangerSoft: "#2B1416",
    dangerFg: "#FF8A8A",
    dangerLine: "#4D2226",
    warning: "#F0A030",
    warningSoft: "#2A1F0C",
    warningFg: "#F5BE6A",
    success: "#2BB383",
    successSoft: "#0F2A20",
    successFg: "#5FD3A6",
  },
} as const;

export type Palette = { [K in keyof typeof Colors.light]: string };

/**
 * `weight` of color `a` blended into `b`, for "#RRGGBB" colors. Stands in for the CSS color-mix() the website
 * uses for company logos and avatars, which React Native doesn't support.
 */
export function mix(a: string, b: string, weight: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(channel(a, i) * weight + channel(b, i) * (1 - weight)));
  return `#${out.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/** The four kinds of calendar item: application deadlines, interview rounds, the user's own events, and task due dates. */
export const KindColors: Record<"light" | "dark", Record<ItemKind, string>> = {
  light: { deadline: "#DC2626", interview: "#E8622C", event: "#4B57D6", task: "#71717A" },
  dark: { deadline: "#E5484D", interview: "#F07A45", event: "#7C86F2", task: "#85858E" },
};

/** Conversion steps: one hue, getting stronger with each step. Reversed in dark mode, like the website. */
export const FunnelColors: Record<"light" | "dark", string[]> = {
  light: ["#86B6EF", "#5598E7", "#256ABF", "#104281"],
  dark: ["#2C5C99", "#3F7FCF", "#6AA2E8", "#A3C7F3"],
};

/** Pipeline stage colors: the dot/bar color, a soft background, and readable text on that background. */
export const StatusColors: Record<"light" | "dark", Record<AppStatus, { mark: string; soft: string; fg: string }>> = {
  light: {
    wishlist: { mark: "#A1A1AA", soft: "#F3F3F5", fg: "#52525B" },
    applied: { mark: "#2A78D6", soft: "#EBF3FD", fg: "#1D5FB3" },
    interviewing: { mark: "#E8622C", soft: "#FDF0EA", fg: "#B1431A" },
    offer: { mark: "#12996A", soft: "#E8F7F0", fg: "#0B7A53" },
    rejected: { mark: "#71717A", soft: "#EFEFF2", fg: "#4A4A52" },
  },
  dark: {
    wishlist: { mark: "#6E6E78", soft: "#232328", fg: "#B4B4BC" },
    applied: { mark: "#4A90E2", soft: "#13233A", fg: "#8EBBF2" },
    interviewing: { mark: "#F07A45", soft: "#331A10", fg: "#F6A57F" },
    offer: { mark: "#2BB383", soft: "#0F2A20", fg: "#5FD3A6" },
    rejected: { mark: "#85858E", soft: "#25252A", fg: "#A8A8B0" },
  },
};
