import { Pressable, StyleSheet } from "react-native";
import { Text } from "@/components/text";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { useTheme } from "@/theme/use-theme";

/**
 * A button for the navigation bar: an SF Symbol (with a label for VoiceOver) or a short text label.
 * `muted` is for secondary actions inside cards, like delete or unlink.
 */
export function HeaderButton({ icon, label, onPress, bold, disabled, muted }: { icon?: SFSymbol; label: string; onPress: () => void; bold?: boolean; disabled?: boolean; muted?: boolean }) {
  const { colors } = useTheme();
  const tint = muted ? colors.fgMuted : colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.button, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }]}
    >
      {icon ? <SymbolView name={icon} size={muted ? 18 : 22} tintColor={tint} /> : <Text style={[styles.text, { color: tint, fontWeight: bold ? "600" : "400" }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minWidth: 32, minHeight: 32, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  text: { fontSize: 17 },
});
