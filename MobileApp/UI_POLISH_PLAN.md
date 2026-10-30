# Pipeline for iOS: making it feel premium

The app now does everything the website does, but it doesn't yet *feel* like the website. The website's polish comes from a small set of deliberate choices, all written down in its `src/index.css`. This plan carries those choices over to the phone and adds the iOS-native touches people expect from a premium app.

Nothing here changes features or data. Every item is visual or tactile, and every library named below runs in Expo Go.

## What makes the website feel clean

From `Web App Wireframe Design/src/index.css` and `components/ui.tsx`:

1. **One typeface, Geist,** carries every level of hierarchy through size and weight. Headings use tight letter-spacing (−0.015em to −0.03em), and numbers use tabular figures.
2. **Neutrals do the structural work; color only carries meaning.** Stage hues mark stages, red means overdue, amber means due soon, and the accent means focus or a link. Nothing is colorful for decoration.
3. **Quiet surfaces:** hairline borders plus a barely-there shadow (`--shadow-xs`) on cards. Dialogs and menus get deeper shadows. In dark mode, surfaces step up in lightness instead of relying on shadows.
4. **Springy, tactile motion.** Buttons shrink 3% on press and spring back (`tactile`); wide rows shrink 1.5% (`tactile-soft`); cards lift 1px (`lift`). The dashboard's blocks rise in with a 45ms stagger; changed numbers settle into place (`value-in`); bars grow in; checkmarks pop; list rows animate in and collapse out. Every spring is tuned (`--ease-spring`, `--ease-snappy`), and everything switches off under reduced motion.
5. **Skeletons, not spinners,** while content loads, so the layout never jumps.
6. **Moments of delight** where they're earned: confetti and a toast for an offer, a count-up on first visit.

## Where the app is today

| | Website | App now | Gap |
|---|---|---|---|
| Typeface | Geist with tight tracking | System font (SF), default tracking | Feels generic |
| Surfaces | Hairline + soft shadow, 10px/14px radii | Hairline only, plain corners | Flat |
| Press feedback | Spring scale 0.97 / 0.985 | Opacity dims | Feels like a web view |
| Entrances | Staggered rise, bars grow, count-up | Nothing animates | Static |
| Lists | Rows animate in and out | Rows jump | Abrupt |
| Loading | Skeletons | Spinners | Layout jumps |
| Menus | Custom popovers | Bottom action sheets | Dated next to iOS context menus |
| Feedback | Toast springs in | Toast fades; few haptics | Thin |
| Brand | Pipeline mark, dark brand panel on sign-in | Plain sign-in; **Expo's default icon and splash** | Not yet "ours" |

## The plan

Ordered by impact for the effort. Each step leaves the app shippable.

### 1. Foundations: type, surfaces, spacing (small effort, biggest change)
- **Geist everywhere.** Load it with `@expo-google-fonts/geist` and `expo-font`, holding the splash screen until it's ready. Map the website's sizes onto `AppText` variants, with tight tracking on titles and headings and tabular figures for every number.
- **Type scale tokens** in `src/theme/`: title 28/34, heading 17/22, body 15/21, label 14/19, small 13/18, micro 11/16. Each one sets its own line height, which also makes clipped numbers like the Insights percentages impossible.
- **Continuous corners.** Add `borderCurve: "continuous"` to every rounded surface. It's iOS's squircle, cheap to apply, and one of the clearest native tells.
- **Depth.** A `shadow-xs` equivalent on cards and stat tiles, and the website's `shadow-pop` / `shadow-dialog` on the toast and sheets. In dark mode, keep relying on lighter surfaces, as the website does.
- **Spacing scale** (4 / 8 / 12 / 16 / 24 / 32), replacing one-off numbers, so every screen breathes the same way.

**Done when:** side-by-side screenshots of Dashboard, Applications and an application's detail page read as the same product as the website.

**Status: done (Oct 29).**
- **Geist:** loaded at startup (`@expo-google-fonts/geist`, weights 400–700), and the splash screen waits for it. `src/components/text.tsx` provides a `Text` and `TextInput` that turn any `fontWeight` into the matching Geist file, so existing styles keep working. All app text, header titles and the Sankey labels use it. Native controls (date pickers, the tab bar, alerts, action sheets) stay in the system font, as iOS intends.
- **Tokens:** `src/theme/tokens.ts` holds the type scale (each size with its own line height and the website's tracking), spacing, corner radii and shadows. `AppText` variants and the dashboard's headline numbers use it.
- **Corners:** every rounded style now draws continuous corners (80 styles). Cards and dashboard tiles use a 12pt radius.
- **Depth:** `Card` casts the website's `shadow-xs`. It's two layers, because iOS drops the shadow of a view that clips its content. Dashboard tiles and Board cards cast it too. In dark mode it fades out, as the website relies on lighter surfaces there.
- **Spacing:** the scale is in place for the page padding and cards. Other screens still use their own numbers, which already sit on the 4-point grid. Convert them as each screen is touched in later steps, rather than in one big churn.

### 2. Touch and motion (medium effort)
All of this uses Reanimated, already installed, so it runs on the UI thread and stays smooth in long lists.
- **`AnimatedPressable`:** one shared press behavior. Scale 0.97 with the website's snappy spring for buttons and chips, 0.985 for rows and cards. It replaces the opacity dimming in `Button`, `Chip`, `ChoiceRow`, list rows, board cards and stat tiles.
- **Entrances:** Dashboard blocks rise in with the 45ms stagger (`FadeInDown.springify()` with delays) on the first visit of a session only, like the website's `useFirstVisit`.
- **Numbers:** stat tiles count up on first visit; afterwards a change settles in (`value-in`).
- **Bars:** the response-rate meter, conversion bars and stage bar grow in.
- **Lists:** `LinearTransition` and `FadeOut` so tasks, attention items and rows animate when added, completed or deleted instead of jumping.
- **Checkbox:** a pop on check (`check-pop`), plus a selection haptic.
- **Segmented control:** a sliding, springing indicator instead of an instant swap.
- **Toast:** springs up from below, as the website's `toast-in` does, on a blurred material (`expo-blur`).
- **Haptics, used sparingly:** selection ticks for segments, chips and pickers; a light impact for toggles and check-offs; success for saving or getting an offer; warning before a destructive confirm.
- **Reduced motion:** every animation checks Reanimated's `useReducedMotion()` and keeps color feedback only, matching the website's `prefers-reduced-motion` rules.

**Done when:** every tap gives feedback under 100ms, nothing on the Dashboard pops in un-animated, and turning on Settings → Accessibility → Motion → Reduce Motion removes the movement.

**Status: done (Oct 29).**
- **Motion values:** `src/theme/motion.ts` holds the website's springs, press scales, the `rise` entrance and the list-row animations, all set to follow Reduce Motion.
- **Presses:** `src/components/pressable-scale.tsx` shrinks 3% on press (buttons, chips) or 1.5% (rows, cards, tiles) and springs back. It's used by `Button`, `Chip`, `ChoiceRow`, application rows, Board cards, dashboard tiles and rows, the More menu, Networking, the Career log, Search results and calendar agenda rows. Calendar grid cells stay still on purpose.
- **Dashboard first visit:** blocks rise in with the 45ms stagger, tile numbers count up, and the response-rate meter, stage bar and conversion bars grow in (`src/components/motion.tsx`, `src/lib/first-visit.ts`). Coming back later is instant. A number that changes afterwards settles into place.
- **Lists:** Needs attention items, tasks and Applications rows animate out when completed or deleted, and the rest slide into place. Nothing animates on first load.
- **Checkbox:** pops when checked.
- **Segmented control:** a sliding indicator that springs to the chosen option.
- **Toast:** springs up from below onto a frosted, tinted surface with the website's deeper shadow.
- **Haptics** (`src/lib/haptics.ts`): a selection tick for segments, chips and choices; a light tap when checking; success when a form saves, a resume is read, or there's an offer; a warning before any destructive confirm.
- **Not done:** entrances on screens other than the Dashboard, to keep motion where it counts as the website does. The toast's slight scale-up isn't included, because Reanimated's preset can only start from an offset.

**Tested:** a fresh load in the simulator caught the Dashboard mid-entrance (numbers counting, meter filling) and then settled on the right values. Segmented indicators sit correctly on Applications and Calendar, with no runtime warnings. **Not yet tested:** press springs, row animations, the toast and haptics need a finger on a real phone (the simulator can't play haptics), along with Reduce Motion.

### 3. Native iOS patterns (medium effort)
- **Context menus instead of action sheets.** Long-pressing an application row, board card, contact or event opens a native iOS context menu with a lifted preview, using `@expo/ui`'s `ContextMenu`. The ⋯ header buttons become native pull-down menus (`Menu`). Keep the action sheet only for "Move to…" from the stage button.
- **Swipe actions on rows,** using Gesture Handler's swipeable rows:
  - Applications: swipe left for Delete, right for Move to…
  - Tasks: swipe to complete or delete
  - Contacts: swipe for Email or Call
- **Sized sheets.** Small forms (new event, new task, link a contact) open as `formSheet` with medium/large detents and a grabber, instead of full-height modals. Big forms stay full height.
- **Large titles.** Revisit once Expo/react-native-screens fixes them blanking next to a search bar (see DEVELOPMENT_PLAN.md, Phase 2). Then use them on every tab's first screen.
- **SF Symbol effects:** the checkmark draws in, the sync icon rotates while it loads, and the bell bounces when something needs attention.

**Done when:** an iOS user could guess every gesture without being told.

**Status: mostly done (Oct 29).**
- **Native menus** (`src/components/native-menu.tsx`, SwiftUI `Menu` through `@expo/ui`):
  - Applications ⋯ (Import / Export, with icons)
  - the Sort control (checkmark on the current field, plus Reverse order)
  - an application's ⋯ (Open job posting, Edit, Delete in red)
  - the Brag doc's share button (Share, Copy as text, Copy as Markdown)
- **Swipe actions** (`src/components/swipe-row.tsx`, Gesture Handler's `ReanimatedSwipeable`, with a selection tick as a row opens):
  - Applications: swipe right to Move, left to Delete. Off in Select mode.
  - Tasks: swipe right for Done / Not done, left to Delete.
  - Contacts: swipe left for Email and Call.
- **Gesture root:** the root layout now wraps the app in `GestureHandlerRootView`, which swipe rows need.
- **Sized sheets:** the event form opens at 75% height and calendar sync at 80%, each with a grabber and draggable to full height.
- **SF Symbol effect:** the Career Coach's sparkle pulses while it's thinking.
- **Housekeeping:** the date pickers moved to the date-picker library's new `onValueChange`, which clears a deprecation warning.
- **Deferred: long-press context menus with a preview on rows.** It means putting React Native rows inside a SwiftUI trigger (`RNHostView`), which `@expo/ui` only documents for menu previews, and it could clash with normal taps. It needs trying by hand on a phone first. Rows keep their long-press action sheets until then.
- **Deferred: large titles,** still waiting on the Expo bug (see DEVELOPMENT_PLAN.md, Phase 2).
- **Not done: more symbol effects** (checkmark draw, sync spin). The checkbox already pops (Step 2), and SF Symbols' built-in effects only offer bounce, pulse and scale.

**Tested:** in the simulator, the native ⋯ menus and the Sort control render in place, rows are opaque with no swipe buttons showing through, and both sheets open at partial height with a grabber. There are no runtime warnings. **Not yet tested:** opening the menus and swiping rows need a finger on a phone.

### 4. Loading and empty states (small effort)
- **Skeletons** shaped like the real content (stat tiles, rows, job cards), with a soft shimmer, replacing every `ActivityIndicator` on first load. Spinners stay only inside buttons.
- **Empty states:** icon tiles in the soft accent tint, and a primary action in each one.
- **Pull to refresh** in the accent color.

### 5. Signature moments (medium effort)
- **Dashboard stat tiles** get the website's soft glow: a top-down gradient from each tile's stage tint (`expo-linear-gradient`), plus a press lift.
- **An offer** gets confetti, a success haptic and the toast, as on the website's Board. Skip the confetti under reduced motion.
- **Board drag-and-drop:** lift the card with a shadow and slight tilt, auto-scroll between columns, and give a haptic when it crosses into a new column. This is also the open item from DEVELOPMENT_PLAN.md Phase 2.
- **Sign-in screen:** bring over the website's dark brand panel (the Pipeline mark, "Your whole job search, organized.", and the four feature lines), with the form below it.

### 6. Brand assets (small effort, required before TestFlight)
- **App icon and splash:** both still use Expo's defaults, which is the first thing a tester sees. Make them from the Pipeline mark, with light and dark variants. This overlaps DEVELOPMENT_PLAN.md Phase 7.

## Research on Mobbin

I couldn't open Mobbin from here: its library needs a signed-in account and returned 403. The apps below are suggestions from my own knowledge of polished iOS apps. Look them up on Mobbin, screenshot the screens you like, and they can be matched closely.

| App | Look at | Why it's relevant |
|---|---|---|
| **Linear** | Issue list, issue detail, swipe actions, context menus | A dense, monochrome, typography-led look, very close to Pipeline's website |
| **Things 3** | Checkbox animation, adding a to-do, headers | The benchmark for tactile check-offs and calm lists (our Tasks and Agenda) |
| **Apple Calendar / Notion Calendar / Fantastical** | Month grid, day agenda, event sheet | Patterns for our Calendar tab |
| **Copilot Money** | Dashboard tiles, small charts, empty states | Premium stat cards and charts, like our Dashboard and Insights |
| **Craft** or **Bear** | Forms, sheets, text editing | Calm, roomy editing screens for Profile, Career log and notes |
| **Apple Wallet / Apple Fitness** | Card stacks, celebration moments | Reference for the offer confetti and stat glows |

On Mobbin, the "Flows" view (for example Onboarding, Create item, Empty state) is usually more useful than single screens, because it shows the transitions too.

## How to check each step
- Take before/after screenshots of the same screens (Dashboard, Applications list and detail, Calendar, Jobs, the sign-in screen) in light and dark.
- Re-run the checks from DEVELOPMENT_PLAN.md: the largest text size, VoiceOver labels, and now Reduce Motion as well.
- Keep the website's rule that color only carries meaning. If a new accent appears somewhere decorative, take it out.
- Watch performance in long lists (Applications, Networking): animations must run on the UI thread, so use Reanimated rather than React Native's `Animated` for anything in a list.

## Risks
- **The custom font adds a little startup time.** The splash screen already waits for the session check, so holding it for fonts too is invisible.
- **Too much motion feels cheap.** The website's durations are short (70–420ms) and its springs barely overshoot. Copy its numbers rather than library defaults.
- **`@expo/ui` context menus are SwiftUI.** They need a `Host` wrapper and have their own styling limits. Try one screen first before converting them all.
