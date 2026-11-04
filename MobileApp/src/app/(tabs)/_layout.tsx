import { NativeTabs } from "expo-router/native-tabs";
import { CareerLogProvider } from "@/data/career-log-store";
import { haptic } from "@/lib/haptics";
import { useTheme } from "@/theme/use-theme";

// The data and toast providers live in the root layout, so screens outside the tabs (like Search) share them.
// The career log is shared by the Coach tab and More's log, entry form and brag doc, so it's loaded once here.
// Icons follow the website: a list for Applications, sparkles for the Career Coach.
export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <CareerLogProvider>
      <NativeTabs backgroundColor={colors.surface} labelStyle={{ selected: { color: colors.accent } }} screenListeners={{ tabPress: () => haptic.select() }}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="applications">
          <NativeTabs.Trigger.Label>Applications</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "list.bullet.rectangle", selected: "list.bullet.rectangle.fill" }} md="list" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="coach">
          <NativeTabs.Trigger.Label>Coach</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="sparkles" md="auto_awesome" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="calendar">
          <NativeTabs.Trigger.Label>Calendar</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="more">
          <NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "ellipsis.circle", selected: "ellipsis.circle.fill" }} md="more_horiz" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </CareerLogProvider>
  );
}
