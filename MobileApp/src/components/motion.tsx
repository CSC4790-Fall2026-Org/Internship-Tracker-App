// Small animated pieces from the website: numbers that count up and settle, and bars that grow in.
import { useEffect, useState, type ReactNode } from "react";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import Animated, { Easing, FadeInDown, LayoutAnimationConfig, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { AppText } from "@/components/ui";

// The website's value-in: a changed number rises the last few points into place.
const VALUE_IN = FadeInDown.withInitialValues({ opacity: 0.25, transform: [{ translateY: 5 }] })
  .duration(260)
  .reduceMotion(ReduceMotion.System);

const easeOut = Easing.bezier(0.2, 0.9, 0.3, 1);

/**
 * A headline number. With `countUp` it counts from zero once (first visit); after that, a change settles in.
 * Values like "70%" count too; anything else ("—") just shows. Screen readers get the real value from the parent.
 */
export function AnimatedNumber({ value, countUp, delayMs = 0, style }: { value: string; countUp: boolean; delayMs?: number; style?: StyleProp<TextStyle> }) {
  const reduceMotion = useReducedMotion();
  const match = /^(\d+)(%?)$/.exec(value);
  const target = match ? Number(match[1]) : null;
  const [shown, setShown] = useState<number | null>(countUp && target !== null && !reduceMotion ? 0 : target);

  useEffect(() => {
    if (!countUp || target === null || reduceMotion) return;
    let frame = 0;
    const start = Date.now() + delayMs;
    const duration = 600;
    const tick = () => {
      const t = Math.min(1, Math.max(0, (Date.now() - start) / duration));
      setShown(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // Counts once, on the first visit; later changes settle in below instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const text = shown !== null && shown !== target ? `${shown}${match?.[2] ?? ""}` : value;
  return (
    <LayoutAnimationConfig skipEntering>
      <Animated.View key={value} entering={VALUE_IN}>
        <AppText style={style} accessibilityElementsHidden importantForAccessibility="no">
          {text}
        </AppText>
      </Animated.View>
    </LayoutAnimationConfig>
  );
}

/** A bar that grows in from the left (the website's `bar-grow`), when `grow` is set. Otherwise it's simply there. */
export function GrowBar({ grow, delayMs = 120, style, children }: { grow: boolean; delayMs?: number; style: StyleProp<ViewStyle>; children?: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const animate = grow && !reduceMotion;
  const progress = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (animate) progress.set(withDelay(delayMs, withTiming(1, { duration: 700, easing: easeOut })));
  }, [animate, delayMs, progress]);
  const scale = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.get() }] }));
  return <Animated.View style={[style, { transformOrigin: "left" }, scale]}>{children}</Animated.View>;
}
