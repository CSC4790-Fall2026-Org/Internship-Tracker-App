import { Pressable, StyleSheet } from "react-native";
import { SymbolView } from "expo-symbols";
import { useData } from "@shared/data/DataContext";
import { AppText } from "@/components/ui";
import { chooseAction } from "@/components/feedback";
import { useTheme } from "@/theme/use-theme";

/** "Related application", like the website's <Select>: opens a menu of your applications, with None first. */
export function ApplicationPicker({ value, onChange, noneLabel = "None" }: { value: string | null; onChange: (id: string | null) => void; noneLabel?: string }) {
  const { applications } = useData();
  const { colors } = useTheme();
  const current = applications.find((a) => a.id === value);

  const pick = () =>
    chooseAction("Related application", [
      { label: noneLabel, onPress: () => onChange(null) },
      ...applications.map((a) => ({ label: `${a.company} · ${a.position}`, onPress: () => onChange(a.id) })),
    ]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Related application: ${current ? `${current.company}, ${current.position}` : noneLabel}. Change`}
      onPress={pick}
      style={({ pressed }) => [styles.field, { borderColor: colors.line, backgroundColor: colors.surface, opacity: pressed ? 0.75 : 1 }]}
    >
      <AppText numberOfLines={1} style={[styles.grow, !current && { color: colors.fgMuted }]}>
        {current ? `${current.company} · ${current.position}` : noneLabel}
      </AppText>
      <SymbolView name="chevron.up.chevron.down" size={13} tintColor={colors.fgMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, borderWidth: 1, borderCurve: "continuous", borderRadius: 10, paddingHorizontal: 12 },
  grow: { flex: 1 },
});
