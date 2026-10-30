// Mobile counterparts of the website's components/ui.tsx: same names where they mean the same thing,
// same colors (theme/colors.ts), sized for touch (44pt targets).
import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from "react-native";
import { SymbolView, type SFSymbol } from "expo-symbols";
import type { AppStatus } from "@shared/data/types";
import { STATUS } from "@shared/data/status";
import { dueTone, formatDate, relativeDay } from "@shared/data/dates";
import { mix } from "@/theme/colors";
import { CORNERS, shadow, SPACE, TYPE } from "@/theme/tokens";
import { Text, TextInput } from "@/components/text";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";
import { PressableScale } from "@/components/pressable-scale";
import { haptic } from "@/lib/haptics";
import { SPRING, SPRING_SNAPPY } from "@/theme/motion";

import { useTheme } from "@/theme/use-theme";

export const RADIUS = CORNERS;
const SEGMENT_PAD = 3;
const SEGMENT_GAP = 2;

// ---------- Text ----------

type TextVariant = "title" | "heading" | "body" | "label" | "muted" | "small";

export function AppText({ variant = "body", style, ...rest }: TextProps & { variant?: TextVariant }) {
  const { colors } = useTheme();
  const color = variant === "muted" || variant === "small" ? colors.fgMuted : variant === "label" ? colors.fg2 : colors.fg;
  return <Text style={[styles[variant], { color }, style]} {...rest} />;
}

// ---------- Layout ----------

/** A scrolling page on the canvas background, with pull to refresh when `onRefresh` is given. */
export function Screen({ title, children, refreshing = false, onRefresh }: { title?: string; children: ReactNode; refreshing?: boolean; onRefresh?: () => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: colors.canvas }}
      contentContainerStyle={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
    >
      {title && (
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
      )}
      {children}
    </ScrollView>
  );
}

/**
 * A surface with the website's hairline border and soft shadow. Two layers, because iOS drops the shadow of a view
 * that clips its content: the outer one casts the shadow, the inner one rounds and clips.
 */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors, scheme } = useTheme();
  const backgroundColor = StyleSheet.flatten(style)?.backgroundColor ?? colors.surface;
  return (
    <View style={[styles.cardShadow, shadow("xs", scheme), { backgroundColor }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }, style]}>{children}</View>
    </View>
  );
}

// ---------- Controls ----------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger-ghost";

export function Button({
  variant = "secondary",
  loading,
  disabled,
  children,
  style,
  ...rest
}: Omit<PressableProps, "children" | "style"> & { variant?: ButtonVariant; loading?: boolean; children: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const look = {
    primary: { bg: colors.ink, fg: colors.onInk, border: colors.ink },
    secondary: { bg: colors.surface, fg: colors.fg, border: colors.line },
    ghost: { bg: "transparent", fg: colors.fg2, border: "transparent" },
    "danger-ghost": { bg: "transparent", fg: colors.dangerFg, border: "transparent" },
  }[variant];
  const inactive = disabled || loading;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      style={({ pressed }) => [styles.button, { backgroundColor: look.bg, borderColor: look.border, opacity: inactive ? 0.55 : pressed ? 0.9 : 1 }, style]}
      {...rest}
    >
      {loading && <ActivityIndicator size="small" color={look.fg} />}
      <Text style={[styles.buttonText, { color: look.fg }]}>{children}</Text>
    </PressableScale>
  );
}

/** A label above a control, with a hint or (taking priority) an error underneath. */
export function Field({ label, hint, error, accessory, children }: { label: string; hint?: string; error?: string | null; accessory?: ReactNode; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <AppText variant="label" style={styles.fieldLabel}>
          {label}
        </AppText>
        {accessory}
      </View>
      {children}
      {error ? <AppText style={[styles.fieldNote, { color: colors.dangerFg }]}>{error}</AppText> : hint ? <AppText variant="small" style={styles.fieldNote}>{hint}</AppText> : null}
    </View>
  );
}

export function Input({ style, ...rest }: TextInputProps) {
  const { colors } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.fgFaint}
      style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.line, color: colors.fg }, style]}
      {...rest}
    />
  );
}

/** Multi-line text, styled like Input. */
export function Textarea({ style, ...rest }: TextInputProps) {
  return <Input multiline textAlignVertical="top" style={[styles.textarea, style]} {...rest} />;
}

/** Pops a little when checked (the website's `check-pop`), with a light tap. */
export function Checkbox({ checked, onPress, label }: { checked: boolean; onPress: () => void; label: string }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  useEffect(() => {
    if (checked && !reduceMotion) {
      scale.set(0.8);
      scale.set(withSpring(1, SPRING));
    }
  }, [checked, reduceMotion, scale]);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => {
        haptic.toggle();
        onPress();
      }}
      hitSlop={10}
      style={styles.checkboxHit}
    >
      <Animated.View style={[styles.checkbox, { borderColor: checked ? colors.ink : colors.lineStrong, backgroundColor: checked ? colors.ink : colors.surface }, pop]}>
        {checked && <SymbolView name="checkmark" size={11} weight="bold" tintColor={colors.onInk} />}
      </Animated.View>
    </Pressable>
  );
}

/** A row of mutually exclusive options, like the website's Segmented and Tabs. */
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (value: T) => void; options: { value: T; label: string; count?: number }[] }) {
  const { colors, scheme } = useTheme();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  // Segments share the row equally, so the indicator's size and position follow from the row's width.
  const segmentWidth = width > 0 ? (width - SEGMENT_PAD * 2 - SEGMENT_GAP * (options.length - 1)) / options.length : 0;
  const offset = useSharedValue(0);
  useEffect(() => {
    const target = index * (segmentWidth + SEGMENT_GAP);
    offset.set(reduceMotion ? target : withSpring(target, SPRING_SNAPPY));
  }, [index, segmentWidth, reduceMotion, offset]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));

  return (
    <View accessibilityRole="tablist" onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={[styles.segmented, { backgroundColor: colors.muted }]}>
      {segmentWidth > 0 && <Animated.View pointerEvents="none" style={[styles.segmentIndicator, shadow("xs", scheme), { width: segmentWidth, backgroundColor: colors.surface }, indicator]} />}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (!active) haptic.select();
              onChange(option.value);
            }}
            style={styles.segment}
          >
            <Text maxFontSizeMultiplier={1.4} style={[styles.segmentText, { color: active ? colors.fg : colors.fgMuted }]} numberOfLines={1}>
              {option.label}
              {option.count !== undefined && <Text style={{ color: colors.fgMuted }}>{`  ${option.count}`}</Text>}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One option in a single-choice list, like the website's onboarding radio cards. */
export function ChoiceRow({ label, hint, selected, onPress }: { label: string; hint?: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      feel="soft"
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={() => {
        if (!selected) haptic.select();
        onPress();
      }}
      style={[styles.choice, { borderColor: selected ? colors.accent : colors.line, backgroundColor: selected ? colors.accentSoft : colors.surface }]}
    >
      <View style={[styles.radio, { borderColor: selected ? colors.accent : colors.lineStrong, backgroundColor: selected ? colors.accent : colors.surface }]}>
        {selected && <SymbolView name="checkmark" size={10} weight="bold" tintColor="#FFFFFF" />}
      </View>
      <View style={styles.choiceText}>
        <AppText style={styles.choiceLabel}>{label}</AppText>
        {hint && <AppText variant="small">{hint}</AppText>}
      </View>
    </PressableScale>
  );
}

/** A toggle chip, like the website's career field picker and Career log filters. */
export function Chip({ label, active, disabled, onPress }: { label: string; active: boolean; disabled?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={[styles.chip, { borderColor: active ? colors.ink : colors.line, backgroundColor: active ? colors.ink : colors.surface, opacity: disabled ? 0.45 : 1 }]}
    >
      {active && <SymbolView name="checkmark" size={12} weight="semibold" tintColor={colors.onInk} />}
      <Text style={[styles.chipText, { color: active ? colors.onInk : colors.fg2 }]}>{label}</Text>
    </PressableScale>
  );
}

// ---------- Feedback & states ----------

const BANNER_ICON: Record<"danger" | "success" | "info", SFSymbol> = {
  danger: "exclamationmark.circle",
  success: "checkmark.circle",
  info: "info.circle",
};

export function Banner({ tone = "danger", children, action }: { tone?: "danger" | "success" | "info"; children: ReactNode; action?: ReactNode }) {
  const { colors } = useTheme();
  const look = {
    danger: { bg: colors.dangerSoft, border: colors.dangerLine, fg: colors.dangerFg },
    success: { bg: colors.successSoft, border: colors.successSoft, fg: colors.successFg },
    info: { bg: colors.subtle, border: colors.line, fg: colors.fg2 },
  }[tone];
  return (
    <View accessibilityRole={tone === "danger" ? "alert" : undefined} style={[styles.banner, { backgroundColor: look.bg, borderColor: look.border }]}>
      <SymbolView name={BANNER_ICON[tone]} size={18} tintColor={look.fg} />
      <View style={styles.bannerBody}>
        <Text style={[styles.bannerText, { color: look.fg }]}>{children}</Text>
        {action}
      </View>
    </View>
  );
}

export function EmptyState({ icon, title, description, children }: { icon?: SFSymbol; title: string; description?: string; children?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      {icon && (
        <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
          <SymbolView name={icon} size={22} tintColor={colors.fgMuted} />
        </View>
      )}
      <AppText variant="heading" style={styles.center}>
        {title}
      </AppText>
      {description && (
        <AppText variant="muted" style={styles.center}>
          {description}
        </AppText>
      )}
      {children}
    </View>
  );
}

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: string }) {
  const { colors } = useTheme();
  const look = {
    neutral: { bg: colors.muted, fg: colors.fg2 },
    accent: { bg: colors.accentSoft, fg: colors.accentFg },
    success: { bg: colors.successSoft, fg: colors.successFg },
    warning: { bg: colors.warningSoft, fg: colors.warningFg },
    danger: { bg: colors.dangerSoft, fg: colors.dangerFg },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: look.bg }]}>
      <Text maxFontSizeMultiplier={1.4} style={[styles.badgeText, { color: look.fg }]}>
        {children}
      </Text>
    </View>
  );
}

/** A due date that gets louder as it nears: red when overdue, amber within three days. Same as the website. */
export function DueChip({ date }: { date: string }) {
  const { colors } = useTheme();
  const tone = dueTone(date);
  const color = tone === "danger" ? colors.dangerFg : tone === "warning" ? colors.warningFg : colors.fgMuted;
  return (
    <Text style={[styles.due, { color, fontWeight: tone === "neutral" ? "400" : "600" }]} accessibilityLabel={`Due ${formatDate(date, { long: true })}`}>
      {tone === "neutral" ? formatDate(date) : relativeDay(date)}
    </Text>
  );
}

/** Monogram tile in the company's color, like the website's CompanyLogo. */
export function CompanyLogo({ name, initials, color, size = 28 }: { name: string; initials?: string; color: string; size?: number }) {
  const { colors } = useTheme();
  const text = initials || name.trim().slice(0, 2).toUpperCase();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderCurve: "continuous", borderRadius: Math.round(size * 0.26),
        backgroundColor: mix(color, colors.surface, 0.13),
        borderWidth: 1,
        borderColor: mix(color, colors.surface, 0.22),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Initials sit in a fixed-size tile, so they don't grow with the text-size setting. */}
      <Text maxFontSizeMultiplier={1} style={{ fontSize: Math.max(9, Math.round(size * 0.36)), fontWeight: "600", color: mix(color, colors.fg, 0.72) }}>
        {text}
      </Text>
    </View>
  );
}

const AVATAR_HUES = ["#2A78D6", "#E8622C", "#12996A", "#4B57D6", "#C2417A", "#0E8DA3", "#8A5A00", "#6E56CF"];

export function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

/** A person's initials in a color picked from their name, like the website's Avatar. */
export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const { colors } = useTheme();
  const hue = AVATAR_HUES[[...name].reduce((h, c) => h + c.charCodeAt(0), 0) % AVATAR_HUES.length];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderCurve: "continuous", borderRadius: size / 2, backgroundColor: mix(hue, colors.surface, 0.14), alignItems: "center", justifyContent: "center" }}
    >
      <Text maxFontSizeMultiplier={1} style={{ fontSize: Math.max(9, Math.round(size * 0.37)), fontWeight: "600", color: mix(hue, colors.fg, 0.75) }}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

export function StatusDot({ status }: { status: AppStatus }) {
  const { status: palette } = useTheme();
  // Wishlist is a hollow ring on the website, so it reads as "not started" without relying on color.
  return status === "wishlist" ? (
    <View style={[styles.dot, { borderWidth: 1.5, borderColor: palette.wishlist.mark }]} />
  ) : (
    <View style={[styles.dot, { backgroundColor: palette[status].mark }]} />
  );
}

export function StatusBadge({ status }: { status: AppStatus }) {
  const { status: palette } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: palette[status].soft }]}>
      <Text maxFontSizeMultiplier={1.4} style={[styles.badgeText, { color: palette[status].fg }]}>
        {STATUS[status].label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: TYPE.title,
  heading: TYPE.heading,
  body: TYPE.body,
  label: TYPE.label,
  muted: TYPE.body,
  small: TYPE.small,
  center: { textAlign: "center" },

  screen: { padding: SPACE[4], gap: SPACE[4], paddingBottom: SPACE[8] * 1.5 },
  cardShadow: { borderRadius: RADIUS.card, borderCurve: "continuous" },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.card, borderCurve: "continuous", padding: SPACE[4], gap: SPACE[3] },

  button: { minHeight: 44, borderCurve: "continuous", borderRadius: RADIUS.control, borderWidth: 1, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonText: { fontSize: 15, fontWeight: "600" },

  field: { gap: 6 },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fieldLabel: { flexShrink: 1 },
  fieldNote: { fontSize: 13, lineHeight: 18 },
  input: { minHeight: 44, borderWidth: 1, borderCurve: "continuous", borderRadius: RADIUS.control, paddingHorizontal: 12, fontSize: 16 },

  textarea: { minHeight: 96, paddingTop: 10, paddingBottom: 10 },
  checkboxHit: { padding: 2 },
  checkbox: { width: 20, height: 20, borderCurve: "continuous", borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  segmented: { flexDirection: "row", borderCurve: "continuous", borderRadius: RADIUS.control, padding: SEGMENT_PAD, gap: SEGMENT_GAP },
  segmentIndicator: { position: "absolute", top: SEGMENT_PAD, bottom: SEGMENT_PAD, left: SEGMENT_PAD, borderCurve: "continuous", borderRadius: 8 },
  segment: { flex: 1, minHeight: 34, borderCurve: "continuous", borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  segmentText: { fontSize: 14, fontWeight: "600" },
  due: { fontSize: 13, fontVariant: ["tabular-nums"] },

  choice: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderCurve: "continuous", borderRadius: RADIUS.control, paddingHorizontal: 14, paddingVertical: 12 },
  radio: { width: 18, height: 18, borderCurve: "continuous", borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  choiceText: { flex: 1, gap: 1 },
  choiceLabel: { fontWeight: "500" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, borderWidth: 1, borderCurve: "continuous", borderRadius: 999, paddingHorizontal: 14 },
  chipText: { fontSize: 14, fontWeight: "500" },

  banner: { flexDirection: "row", gap: 10, borderWidth: 1, borderCurve: "continuous", borderRadius: RADIUS.card, padding: 12 },
  bannerBody: { flex: 1, gap: 8 },
  bannerText: { fontSize: 14, lineHeight: 20 },

  empty: { alignItems: "center", gap: 8, paddingVertical: 32, paddingHorizontal: 16 },
  emptyIcon: { width: 48, height: 48, borderCurve: "continuous", borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 4 },

  dot: { width: 9, height: 9, borderCurve: "continuous", borderRadius: 5 },
  badge: { borderCurve: "continuous", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: "600" },
});
