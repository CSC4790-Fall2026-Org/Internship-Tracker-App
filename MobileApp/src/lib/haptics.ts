// One place for haptics, so they stay consistent: a light tap for buttons, a tick for choosing, a tap for toggling,
// success for things saved, a warning before something destructive.
import * as Haptics from "expo-haptics";

const safely = (run: () => Promise<void>) => {
  run().catch(() => {});
};

export const haptic = {
  /** Pressing a button, row or card. Most presses go through HapticPressable or PressableScale. */
  tap: () => safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Picking an option: segments, chips, pickers. */
  select: () => safely(() => Haptics.selectionAsync()),
  /** Toggling something on or off: checkboxes, completing a task. */
  toggle: () => safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Picking something up to drag it, like a Home Screen icon, or a long press opening a menu. */
  lift: () => safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Something saved or achieved: a form saved, an offer. */
  success: () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Before confirming something destructive. */
  warning: () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
