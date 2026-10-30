import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/text";
import { AppText } from "@/components/ui";
import { useTheme } from "@/theme/use-theme";

/** **bold** and `code` inside a line. */
function inline(text: string, colors: { fg: string; muted: string }): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <Text key={i} style={{ fontWeight: "600", color: colors.fg }}>
        {part.slice(2, -2)}
      </Text>
    ) : part.startsWith("`") && part.endsWith("`") && part.length > 2 ? (
      <Text key={i} style={[styles.code, { backgroundColor: colors.muted }]}>
        {part.slice(1, -1)}
      </Text>
    ) : (
      part
    ),
  );
}

type Block = { kind: "p"; lines: string[] } | { kind: "ul" | "ol"; items: { text: string; depth: number }[] };

/**
 * The coach is asked for prose, "-" bullets and **bold**. This renders just that (plus numbered lists and stray
 * headings shown as bold lines), the same way as the website's Career Coach page.
 */
export function RichText({ text }: { text: string }) {
  const { colors } = useTheme();
  const inlineColors = { fg: colors.fg, muted: colors.muted };
  const blocks: Block[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const bullet = line.match(/^(\s*)[-*•]\s+(.*)$/);
    const numbered = line.match(/^(\s*)\d+[.)]\s+(.*)$/);
    const last = blocks[blocks.length - 1];
    if (bullet || numbered) {
      const [, indent, body] = (bullet ?? numbered)!;
      const kind = bullet ? "ul" : "ol";
      const item = { text: body, depth: indent.length >= 2 ? 1 : 0 };
      // Nested items stay in their parent's list whatever their marker.
      if (last && last.kind !== "p" && (last.kind === kind || item.depth > 0)) last.items.push(item);
      else blocks.push({ kind, items: [item] });
    } else if (!line.trim()) {
      if (last?.kind === "p" && last.lines.length > 0) blocks.push({ kind: "p", lines: [] });
    } else {
      const heading = line.match(/^#{1,6}\s+(.*)$/);
      const content = heading ? `**${heading[1].replace(/\*\*/g, "")}**` : line.trim();
      if (last?.kind === "p") last.lines.push(content);
      else blocks.push({ kind: "p", lines: [content] });
    }
  }

  return (
    <View style={styles.blocks}>
      {blocks.map((block, i) => {
        if (block.kind === "p") {
          if (block.lines.length === 0) return null;
          return (
            <AppText key={i} style={[styles.body, { color: colors.fg2 }]}>
              {block.lines.flatMap((l, j) => [...(j > 0 ? ["\n"] : []), ...inline(l, inlineColors)])}
            </AppText>
          );
        }
        let n = 0;
        return (
          <View key={i} style={styles.list}>
            {block.items.map((item, j) => {
              if (item.depth === 0) n += 1;
              return (
                <View key={j} style={[styles.item, item.depth > 0 && styles.nested]}>
                  <AppText style={[styles.marker, { color: colors.fgMuted }]}>{block.kind === "ol" && item.depth === 0 ? `${n}.` : item.depth > 0 ? "◦" : "•"}</AppText>
                  <AppText style={[styles.body, styles.grow, { color: colors.fg2 }]}>{inline(item.text, inlineColors)}</AppText>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  blocks: { gap: 10 },
  body: { fontSize: 15, lineHeight: 22 },
  list: { gap: 4 },
  item: { flexDirection: "row", gap: 8 },
  nested: { marginLeft: 18 },
  marker: { width: 16, fontSize: 15, lineHeight: 22, textAlign: "right" },
  grow: { flex: 1 },
  code: { fontFamily: "Menlo", fontSize: 13 },
});
