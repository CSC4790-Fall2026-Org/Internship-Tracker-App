// One place for haptics, so they stay consistent and sparing: a tick for choosing, a tap for toggling,
// success for things saved, a warning before something destructive.
import * as Haptics from "expo-haptics";

const safely = (run: () => Promise<void>) => {
  run().catch(() => {});
};

export const haptic = {
  /** Picking an option: segments, chips, pickers. */
  select: () => safely(() => Haptics.selectionAsync()),
  /** Toggling something on or off: checkboxes, completing a task. */
  toggle: () => safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Something saved or achieved: a form saved, an offer. */
  success: () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Before confirming something destructive. */
  warning: () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
