// Swipe actions on list rows, like Mail and Reminders: swipe to reveal buttons, tap one, and the row closes.
import { useRef, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { Text } from "@/components/text";
import { haptic } from "@/lib/haptics";

export interface SwipeAction {
  label: string;
  icon: SFSymbol;
  color: string;
  onPress: () => void;
}

const ACTION_WIDTH = 76;

function Actions({ actions, close }: { actions: SwipeAction[]; close: () => void }) {
  return (
    <View style={styles.actions}>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={() => {
            close();
            action.onPress();
          }}
          style={[styles.action, { backgroundColor: action.color }]}
        >
          <SymbolView name={action.icon} size={18} tintColor="#FFFFFF" />
          <Text style={styles.actionText}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * `leading` actions show when swiping right, `trailing` when swiping left. Off while `enabled` is false, for example in
 * Select mode. VoiceOver users get the same actions from each screen's long-press menu.
 */
export function SwipeRow({ leading = [], trailing = [], enabled = true, children }: { leading?: SwipeAction[]; trailing?: SwipeAction[]; enabled?: boolean; children: ReactNode }) {
  const ref = useRef<SwipeableMethods>(null);
  const close = () => ref.current?.close();
  return (
    <ReanimatedSwipeable
      ref={ref}
      enabled={enabled}
      friction={2}
      overshootLeft={false}
      overshootRight={false}
      leftThreshold={ACTION_WIDTH / 2}
      rightThreshold={ACTION_WIDTH / 2}
      onSwipeableWillOpen={() => haptic.select()}
      renderLeftActions={leading.length ? () => <Actions actions={leading} close={close} /> : undefined}
      renderRightActions={trailing.length ? () => <Actions actions={trailing} close={close} /> : undefined}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row" },
  action: { width: ACTION_WIDTH, alignItems: "center", justifyContent: "center", gap: 4 },
  actionText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
});
