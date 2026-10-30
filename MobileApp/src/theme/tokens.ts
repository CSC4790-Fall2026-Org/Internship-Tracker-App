// Type, spacing, corners and shadows, taken from the website's src/index.css so both apps read as one product.
import type { TextStyle, ViewStyle } from "react-native";

/**
 * The type scale. Every size carries its own line height (so large numbers never clip) and the website's tracking:
 * titles tight (about −0.025em), headings slightly tight, body text untouched.
 */
export const TYPE = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: "700", letterSpacing: -0.7 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: "600", letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 21 },
  label: { fontSize: 14, lineHeight: 19, fontWeight: "500" },
  small: { fontSize: 13, lineHeight: 18 },
  micro: { fontSize: 11, lineHeight: 16 },
  /** Headline numbers, like the dashboard tiles. */
  display: { fontSize: 28, lineHeight: 32, fontWeight: "600", letterSpacing: -0.8, fontVariant: ["tabular-nums"] },
} satisfies Record<string, TextStyle>;

/** 4-point spacing steps. */
export const SPACE = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32 } as const;

/** iOS's continuous ("squircle") corners: the same radius, drawn the way the system draws its own controls. */
export const CORNERS = { card: 12, control: 10, dialog: 14 } as const;

/**
 * The website's shadows. iOS can't stack two shadows on one view, so each uses the softer, larger of the pair.
 * In dark mode the website steps surfaces up in lightness instead, so these fade right down there.
 */
export function shadow(level: "xs" | "card" | "pop", scheme: "light" | "dark"): ViewStyle {
  const dark = scheme === "dark";
  switch (level) {
    case "xs":
      return { shadowColor: "#101014", shadowOpacity: dark ? 0 : 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } };
    case "card":
      return { shadowColor: "#101014", shadowOpacity: dark ? 0.3 : 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } };
    case "pop":
      return { shadowColor: "#101014", shadowOpacity: dark ? 0.6 : 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } };
  }
}
