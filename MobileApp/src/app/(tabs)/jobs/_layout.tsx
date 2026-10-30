import { Stack } from "expo-router";
import { useTheme } from "@/theme/use-theme";
import { GEIST } from "@/components/text";

export default function JobsLayout() {
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
      <Stack.Screen name="index" options={{ title: "Jobs" }} />
    </Stack>
  );
}
