import { useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";

// Keep in sync with the inline script in index.html, which applies the theme before first paint.
const THEME_KEY = "pipeline.theme";
const media = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function resolve(pref: ThemePreference): "light" | "dark" {
  return pref === "system" ? (media?.matches ? "dark" : "light") : pref;
}

/** Current resolved theme plus a setter. Follows the OS setting until the user picks one explicitly. */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);
  const [systemDark, setSystemDark] = useState(() => media?.matches ?? false);
  const theme = preference === "system" ? (systemDark ? "dark" : "light") : preference;

  useEffect(() => {
    if (!media) return;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setTheme = (next: ThemePreference) => {
    try {
      if (next === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {
      // Blocked storage: the choice still applies for this visit.
    }
    setPreference(next);
  };

  return { theme, preference, setTheme, toggle: () => setTheme(resolve(preference) === "dark" ? "light" : "dark") };
}
