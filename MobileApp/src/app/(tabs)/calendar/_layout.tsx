import { Stack } from "expo-router";
import { useTheme } from "@/theme/use-theme";
import { GEIST } from "@/components/text";

// Opening an event from the dashboard still puts the calendar underneath it.
export const unstable_settings = { anchor: "index" };

// The calendar, with the event form and the sync link sliding up as sheets.
export default function CalendarLayout() {
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
      <Stack.Screen name="index" options={{ title: "Calendar" }} />
      {/* Sized sheets with a grabber: they open part-way and drag up to full height. */}
      <Stack.Screen name="event" options={{ presentation: "formSheet", sheetAllowedDetents: [0.75, 1], sheetGrabberVisible: true }} />
      <Stack.Screen name="sync" options={{ presentation: "formSheet", sheetAllowedDetents: [0.8, 1], sheetGrabberVisible: true, title: "Sync your calendar" }} />
    </Stack>
  );
}
