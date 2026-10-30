// The website's motion (src/index.css, src/lib/motion.ts) as Reanimated values. Short durations and springs that
// barely overshoot: ~70ms to press in, ~320ms to settle, ~420ms for a block to rise in.
import { Easing, FadeIn, FadeInDown, FadeOut, LinearTransition, ReduceMotion, type WithSpringConfig } from "react-native-reanimated";

/** --ease-snappy: about 0.5% overshoot. Presses, bars, indicators. */
export const SPRING_SNAPPY: WithSpringConfig = { damping: 26, stiffness: 420, mass: 0.7 };
/** --ease-spring: about 1.5% overshoot. Things that travel. */
export const SPRING: WithSpringConfig = { damping: 18, stiffness: 240, mass: 0.8 };
/** --ease-fluid, for list rows growing and collapsing. */
export const EASE_FLUID = Easing.bezier(0.2, 0.9, 0.3, 1);

/** How far a press shrinks: 3% for buttons and chips, 1.5% for wide rows and cards (`tactile` / `tactile-soft`). */
export const PRESS_SCALE = { firm: 0.97, soft: 0.985 } as const;

// Every layout animation follows the phone's Reduce Motion setting.
const system = ReduceMotion.System;

/** The website's `rise`: a block fades in from 8pt below, `index` blocks after the first with a 45ms stagger. */
export const rise = (index: number) =>
  FadeInDown.withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] })
    .springify()
    .dampingRatio(0.82)
    .duration(420)
    .delay(index * 45)
    .reduceMotion(system);

/** List rows: fade in, slide others into place, fade out. */
export const ROW_ENTER = FadeIn.duration(220).reduceMotion(system);
export const ROW_EXIT = FadeOut.duration(180).reduceMotion(system);
export const ROW_LAYOUT = LinearTransition.duration(260).easing(EASE_FLUID).reduceMotion(system);
