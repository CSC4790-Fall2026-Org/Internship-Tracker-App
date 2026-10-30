import { useState } from "react";
import { Pressable, type PressableProps, type PressableStateCallbackType, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { PRESS_SCALE, SPRING_SNAPPY } from "@/theme/motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, "style"> & {
  /** "firm" (3%) for buttons and chips, "soft" (1.5%) for wide rows and cards. Same as the website's tactile utilities. */
  feel?: keyof typeof PRESS_SCALE;
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
};

/**
 * A Pressable that shrinks slightly when pressed and springs back on release, on the UI thread. With Reduce Motion on,
 * it keeps only the colour feedback, like the website.
 */
export function PressableScale({ feel = "firm", style, onPressIn, onPressOut, disabled, ...rest }: Props) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  // Style functions get the pressed state, as with a plain Pressable.
  const [pressed, setPressed] = useState(false);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        setPressed(true);
        if (!reduceMotion) scale.set(withTiming(PRESS_SCALE[feel], { duration: 70 }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        if (!reduceMotion) scale.set(withSpring(1, SPRING_SNAPPY));
        onPressOut?.(e);
      }}
      style={[typeof style === "function" ? style({ pressed, hovered: false }) : style, animated]}
    />
  );
}
