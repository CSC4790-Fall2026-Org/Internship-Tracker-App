import { Stack } from "expo-router";
import { CareerLogProvider } from "@/data/career-log-store";
import { useTheme } from "@/theme/use-theme";
import { GEIST } from "@/components/text";

// Opening a contact from an application still puts More underneath it.
export const unstable_settings = { anchor: "index" };

// The website's other pages, reached from the More menu. The career log is shared by the log, its entry form
// and the brag doc, so it's loaded once here.
export default function MoreLayout() {
  const { colors } = useTheme();
  return (
    <CareerLogProvider>
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
        <Stack.Screen name="networking" options={{ title: "Networking", headerBackTitle: "More" }} />
        <Stack.Screen name="contact" options={{ presentation: "modal" }} />
        <Stack.Screen name="career-log" options={{ title: "Career log", headerBackTitle: "More" }} />
        <Stack.Screen name="entry" options={{ presentation: "modal" }} />
        <Stack.Screen name="brag-doc" options={{ title: "Brag doc" }} />
        <Stack.Screen name="profile" options={{ title: "Profile", headerBackTitle: "More" }} />
        <Stack.Screen name="coach" options={{ presentation: "modal", title: "Career Coach" }} />
      </Stack>
    </CareerLogProvider>
  );
}
