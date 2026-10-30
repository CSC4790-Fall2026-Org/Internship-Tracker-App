// Phone versions of the website's components/feedback.tsx: toast() for short confirmations, and confirm() /
// chooseAction() built on the native alert and action sheet instead of custom dialogs.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import Animated, { FadeInDown, FadeOut, ReduceMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/text";
import { haptic } from "@/lib/haptics";
import { CORNERS, shadow } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";

type ToastTone = "default" | "error";
type ToastAction = { label: string; onPress: () => void };
type ToastFn = (message: string, opts?: { tone?: ToastTone; action?: ToastAction }) => void;

const ToastContext = createContext<ToastFn | null>(null);

// Clears the floating tab bar.
const TAB_BAR_CLEARANCE = 64;

// The website's toast-in: up from 12pt below, settling on a spring. Out: a quick fade.
const TOAST_IN = FadeInDown.withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] })
  .springify()
  .dampingRatio(0.8)
  .duration(300)
  .reduceMotion(ReduceMotion.System);
const TOAST_OUT = FadeOut.duration(180).reduceMotion(ReduceMotion.System);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<{ id: number; message: string; tone: ToastTone; action?: ToastAction } | null>(null);

  const toast = useCallback<ToastFn>((message, opts) => {
    setCurrent({ id: Date.now(), message, tone: opts?.tone ?? "default", action: opts?.action });
    AccessibilityInfo.announceForAccessibility(message);
  }, []);

  useEffect(() => {
    if (!current) return;
    // Errors and undoable actions stay up longer, since they need reading or a tap.
    const timer = setTimeout(() => setCurrent(null), current.tone === "error" || current.action ? 5000 : 2600);
    return () => clearTimeout(timer);
  }, [current]);

  const error = current?.tone === "error";
  const textColor = error ? "#FFFFFF" : colors.onInk;

  return (
    <ToastContext value={toast}>
      {children}
      {current && (
        // Keyed by toast, so a new one replaces the old with its own entrance.
        <Animated.View
          key={current.id}
          entering={TOAST_IN}
          exiting={TOAST_OUT}
          pointerEvents={current.action ? "box-none" : "none"}
          style={[styles.toastShadow, shadow("pop", scheme), { bottom: insets.bottom + TAB_BAR_CLEARANCE }]}
        >
          <View style={styles.toast}>
            {/* A frosted material under a tinted layer: the ink colour stays, with the page softly showing through. */}
            <BlurView intensity={40} tint={scheme === "dark" ? "systemChromeMaterialLight" : "systemChromeMaterialDark"} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: error ? colors.danger : colors.ink, opacity: error ? 0.94 : 0.86 }]} />
            <Text style={[styles.toastText, { color: textColor }]}>{current.message}</Text>
            {current.action && (
            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => {
                current.action?.onPress();
                setCurrent(null);
              }}
            >
              <Text style={[styles.toastAction, { color: textColor }]}>{current.action.label}</Text>
            </Pressable>
            )}
          </View>
        </Animated.View>
      )}
    </ToastContext>
  );
}

export function useToast(): ToastFn {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast must be used inside <ToastProvider>");
  return toast;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Resolves true if the person confirms. `destructive` shows the confirm button in red, like the website's danger tone. */
export function confirm({ title, message, confirmLabel, destructive }: { title: string; message?: string; confirmLabel: string; destructive?: boolean }): Promise<boolean> {
  if (destructive) haptic.warning();
  return new Promise((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: confirmLabel, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}

export interface ActionOption {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

/** A native menu of actions (the action sheet on iOS), like the website's Menu. */
export function chooseAction(title: string | undefined, options: ActionOption[]) {
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: [...options.map((o) => o.label), "Cancel"],
        cancelButtonIndex: options.length,
        destructiveButtonIndex: options.flatMap((o, i) => (o.destructive ? [i] : [])),
      },
      (index) => options[index]?.onPress(),
    );
    return;
  }
  Alert.alert(title ?? "", undefined, [...options.map((o) => ({ text: o.label, style: o.destructive ? ("destructive" as const) : ("default" as const), onPress: o.onPress })), { text: "Cancel", style: "cancel" }]);
}

const styles = StyleSheet.create({
  toastShadow: { position: "absolute", left: 16, right: 16, borderCurve: "continuous", borderRadius: CORNERS.dialog },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    borderCurve: "continuous",
    borderRadius: CORNERS.dialog,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toastText: { flexShrink: 1, fontSize: 15, fontWeight: "500", textAlign: "center" },
  toastAction: { fontSize: 15, fontWeight: "700", textDecorationLine: "underline" },
});
