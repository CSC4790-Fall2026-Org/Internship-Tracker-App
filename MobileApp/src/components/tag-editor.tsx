import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { TextInput } from "@/components/text";
import { SymbolView } from "expo-symbols";
import { AppText } from "@/components/ui";
import { useTheme } from "@/theme/use-theme";

/** The website's TagEditor: chips you can remove, plus a field that adds one on return, comma or blur. */
export function TagEditor({ tags, onChange, placeholder, label }: { tags: string[]; onChange: (tags: string[]) => void; placeholder: string; label: string }) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState("");

  const add = (value: string) => {
    const tag = value.trim();
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setDraft("");
  };

  return (
    <View style={[styles.box, { borderColor: colors.line, backgroundColor: colors.surface }]}>
      {tags.map((tag) => (
        <View key={tag} style={[styles.tag, { backgroundColor: colors.muted }]}>
          <AppText style={[styles.tagText, { color: colors.fg2 }]}>{tag}</AppText>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${tag}`} onPress={() => onChange(tags.filter((t) => t !== tag))} hitSlop={8}>
            <SymbolView name="xmark" size={10} weight="semibold" tintColor={colors.fgMuted} />
          </Pressable>
        </View>
      ))}
      <TextInput
        accessibilityLabel={`Add ${label}`}
        value={draft}
        placeholder={tags.length === 0 ? placeholder : `+ ${label}`}
        placeholderTextColor={colors.fgFaint}
        // A comma also adds, like the website.
        onChangeText={(text) => (text.endsWith(",") ? add(text.slice(0, -1)) : setDraft(text))}
        onSubmitEditing={() => add(draft)}
        onBlur={() => add(draft)}
        submitBehavior="submit"
        returnKeyType="done"
        style={[styles.input, { color: colors.fg }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, minHeight: 44, borderWidth: 1, borderCurve: "continuous", borderRadius: 10, padding: 6 },
  tag: { flexDirection: "row", alignItems: "center", gap: 6, borderCurve: "continuous", borderRadius: 6, paddingLeft: 8, paddingRight: 8, paddingVertical: 4 },
  tagText: { fontSize: 13, fontWeight: "500" },
  input: { flexGrow: 1, minWidth: 100, fontSize: 15, paddingHorizontal: 4, paddingVertical: 6 },
});
