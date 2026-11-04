// A Pressable that answers with a haptic: a light tap when pressed, and a firmer bump when a long press opens
// something, like a context menu. Haptics fire on press rather than touch-down, so scrolling past stays silent.
import { Pressable, type GestureResponderEvent, type PressableProps } from "react-native";
import { haptic } from "@/lib/haptics";

/**
 * "tap" for buttons and rows, "select" for picking one option, "toggle" for switching something on or off,
 * "none" where the control plays its own haptic.
 */
export type PressFeedback = "tap" | "select" | "toggle" | "none";

type Handler = ((e: GestureResponderEvent) => void) | null | undefined;

/** Wraps press handlers with their haptics. Shared with PressableScale. */
export function withHaptics(feedback: PressFeedback, onPress: Handler, onLongPress: Handler) {
  return {
    onPress: onPress
      ? (e: GestureResponderEvent) => {
          if (feedback !== "none") haptic[feedback]();
          onPress(e);
        }
      : undefined,
    onLongPress: onLongPress
      ? (e: GestureResponderEvent) => {
          haptic.lift();
          onLongPress(e);
        }
      : undefined,
  };
}

export function HapticPressable({ feedback = "tap", onPress, onLongPress, ...rest }: PressableProps & { feedback?: PressFeedback }) {
  return <Pressable {...rest} {...withHaptics(feedback, onPress, onLongPress)} />;
}
