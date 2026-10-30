import { Pressable, StyleSheet, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { isoOf, toDate, todayISO } from "@shared/data/dates";
import { AppText } from "@/components/ui";
import { useTheme } from "@/theme/use-theme";

/**
 * A date stored as "YYYY-MM-DD", like the website's <input type="date">. Empty shows "Add date"; set shows the
 * native compact picker, plus a clear button unless the date is `required`.
 */
export function DateField({ value, onChange, label, maximumDate, required }: { value: string; onChange: (iso: string) => void; label: string; maximumDate?: string; required?: boolean }) {
  const { colors, scheme } = useTheme();

  if (!value) {
    return <AddButton icon="calendar.badge.plus" text="Add date" label={`Add ${label.toLowerCase()}`} onPress={() => onChange(maximumDate && maximumDate < todayISO() ? maximumDate : todayISO())} />;
  }

  return (
    <View style={styles.row}>
      <DateTimePicker
        value={toDate(value)}
        mode="date"
        display="compact"
        themeVariant={scheme}
        accentColor={colors.accent}
        maximumDate={maximumDate ? toDate(maximumDate) : undefined}
        accessibilityLabel={label}
        onValueChange={(_event, date) => onChange(isoOf(date))}
      />
      {!required && <ClearButton label={`Clear ${label.toLowerCase()}`} onPress={() => onChange("")} />}
    </View>
  );
}

/** An optional time stored as "HH:MM", like the website's <input type="time">. */
export function TimeField({ value, onChange, label }: { value: string; onChange: (time: string) => void; label: string }) {
  const { colors, scheme } = useTheme();

  if (!value) {
    return <AddButton icon="clock.badge" text="Add time" label={`Add ${label.toLowerCase()}`} onPress={() => onChange("09:00")} />;
  }

  const [h, m] = value.split(":").map(Number);
  const asDate = new Date(2000, 0, 1, h, m);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <View style={styles.row}>
      <DateTimePicker
        value={asDate}
        mode="time"
        display="compact"
        minuteInterval={5}
        themeVariant={scheme}
        accentColor={colors.accent}
        accessibilityLabel={label}
        onValueChange={(_event, date) => onChange(`${pad(date.getHours())}:${pad(date.getMinutes())}`)}
      />
      <ClearButton label={`Clear ${label.toLowerCase()}`} onPress={() => onChange("")} />
    </View>
  );
}

function AddButton({ icon, text, label, onPress }: { icon: SFSymbol; text: string; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.empty, { borderColor: colors.line, backgroundColor: colors.surface, opacity: pressed ? 0.75 : 1 }]}
    >
      <SymbolView name={icon} size={17} tintColor={colors.fgMuted} />
      <AppText variant="muted">{text}</AppText>
    </Pressable>
  );
}

function ClearButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={10} style={styles.clear}>
      <SymbolView name="xmark.circle.fill" size={20} tintColor={colors.fgFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, borderWidth: 1, borderCurve: "continuous", borderRadius: 10, paddingHorizontal: 12, alignSelf: "flex-start" },
  row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  clear: { padding: 4 },
});
