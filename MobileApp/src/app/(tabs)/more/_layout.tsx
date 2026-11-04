import { Stack } from "expo-router";
import { useTheme } from "@/theme/use-theme";
import { GEIST } from "@/components/text";

// Opening a contact from an application still puts More underneath it.
export const unstable_settings = { anchor: "index" };

// The website's other pages, reached from the More menu. The career log they share is loaded in the tabs layout.
export default function MoreLayout() {
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
      <Stack.Screen name="index" options={{ title: "More" }} />
      <Stack.Screen name="jobs" options={{ title: "Jobs", headerBackTitle: "More" }} />
      <Stack.Screen name="networking" options={{ title: "Networking", headerBackTitle: "More" }} />
      <Stack.Screen name="contact" options={{ presentation: "modal" }} />
      <Stack.Screen name="career-log" options={{ title: "Career log", headerBackTitle: "More" }} />
      <Stack.Screen name="entry" options={{ presentation: "modal" }} />
      <Stack.Screen name="brag-doc" options={{ title: "Brag doc" }} />
      <Stack.Screen name="profile" options={{ title: "Profile", headerBackTitle: "More" }} />
    </Stack>
  );
}
