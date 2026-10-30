import { NativeTabs } from "expo-router/native-tabs";
import { useTheme } from "@/theme/use-theme";

// The data and toast providers live in the root layout, so screens outside the tabs (like Search) share them.
// Icons follow the website: a list for Applications, a briefcase for Jobs.
export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <NativeTabs backgroundColor={colors.surface} labelStyle={{ selected: { color: colors.accent } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="applications">
        <NativeTabs.Trigger.Label>Applications</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "list.bullet.rectangle", selected: "list.bullet.rectangle.fill" }} md="list" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="calendar">
        <NativeTabs.Trigger.Label>Calendar</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="jobs">
        <NativeTabs.Trigger.Label>Jobs</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "briefcase", selected: "briefcase.fill" }} md="work" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "ellipsis.circle", selected: "ellipsis.circle.fill" }} md="more_horiz" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
