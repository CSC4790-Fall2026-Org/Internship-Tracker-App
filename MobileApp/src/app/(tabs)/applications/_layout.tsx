import { Stack } from "expo-router";
import { useTheme } from "@/theme/use-theme";
import { GEIST } from "@/components/text";

// Opening an application from another tab (the dashboard, the calendar) still puts the list underneath it,
// so Back lands somewhere sensible.
export const unstable_settings = { anchor: "index" };

// List → detail inside the Applications tab; the add/edit form slides up as a sheet over everything.
export default function ApplicationsLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.accent,
        headerTitleStyle: { color: colors.fg, fontFamily: GEIST.semibold },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      {/* Large titles render blank with the search bar on iOS 26 in this SDK, so the list uses the standard title. */}
      <Stack.Screen name="index" options={{ title: "Applications" }} />
      <Stack.Screen name="[id]" options={{ title: "", headerBackTitle: "Applications" }} />
      <Stack.Screen name="form" options={{ presentation: "modal" }} />
    </Stack>
  );
}
