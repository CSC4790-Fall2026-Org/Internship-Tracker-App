// Native iOS pull-down menus (SwiftUI, through @expo/ui), for the ⋯ buttons and the sort control. They open from
// where you tap, with SF Symbols and red destructive items, like the menus in Apple's own apps.
import { Button as MenuButton, Divider, Host, Menu } from "@expo/ui/swift-ui";
import { font, labelStyle, tint } from "@expo/ui/swift-ui/modifiers";
import type { SFSymbol } from "expo-symbols";
import { useTheme } from "@/theme/use-theme";

export interface MenuItem {
  label: string;
  icon?: SFSymbol;
  destructive?: boolean;
  /** Shows a checkmark, for the current choice in a picker-style menu. */
  checked?: boolean;
  onPress: () => void;
}

export type MenuEntry = MenuItem | "divider";

function Items({ items }: { items: MenuEntry[] }) {
  return items.map((item, i) =>
    item === "divider" ? (
      <Divider key={`divider-${i}`} />
    ) : (
      <MenuButton key={item.label} label={item.label} systemImage={item.checked ? "checkmark" : item.icon} role={item.destructive ? "destructive" : undefined} onPress={item.onPress} />
    ),
  );
}

/** An icon-only menu button for a navigation bar, like the ⋯ button. `label` is read by VoiceOver. */
export function HeaderMenu({ icon = "ellipsis.circle", label, items }: { icon?: SFSymbol; label: string; items: MenuEntry[] }) {
  const { colors, scheme } = useTheme();
  return (
    <Host matchContents colorScheme={scheme}>
      <Menu label={label} systemImage={icon} modifiers={[labelStyle("iconOnly"), tint(colors.accent), font({ size: 20 })]}>
        <Items items={items} />
      </Menu>
    </Host>
  );
}

/** A menu whose trigger is a short text label in the accent colour, like "Sort: Deadline ↑". */
export function TextMenu({ label, items }: { label: string; items: MenuEntry[] }) {
  const { colors, scheme } = useTheme();
  return (
    <Host matchContents colorScheme={scheme}>
      <Menu label={label} modifiers={[labelStyle("titleOnly"), tint(colors.accent), font({ size: 15, weight: "medium" })]}>
        <Items items={items} />
      </Menu>
    </Host>
  );
}
