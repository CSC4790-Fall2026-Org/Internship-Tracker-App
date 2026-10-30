// Light, dark, or follow the phone, like the website's theme toggle (src/lib/theme.ts). Saved on the device under
// the same key name. Appearance.setColorScheme overrides useColorScheme everywhere, so every screen follows it.
import "expo-sqlite/localStorage/install";
import { useState } from "react";
import { Appearance } from "react-native";

export type ThemePreference = "light" | "dark" | "system";

const THEME_KEY = "pipeline.theme";

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

const apply = (pref: ThemePreference) => Appearance.setColorScheme(pref === "system" ? "unspecified" : pref);

/** Call once at startup, before the first screen draws. */
export function applySavedTheme() {
  apply(readPreference());
}

export function useThemePreference() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);
  const choose = (pref: ThemePreference) => {
    setPreference(pref);
    apply(pref);
    try {
      if (pref === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, pref);
    } catch {
      // Storage unavailable: the choice still applies until the app restarts.
    }
  };
  return [preference, choose] as const;
}
