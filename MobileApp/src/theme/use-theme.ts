import { useColorScheme } from "react-native";
import { Colors, FunnelColors, KindColors, StatusColors } from "./colors";

/** The palette for the phone's current light/dark setting. */
export function useTheme() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return { scheme, colors: Colors[scheme], status: StatusColors[scheme], kind: KindColors[scheme], funnel: FunnelColors[scheme] } as const;
}
