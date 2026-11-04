import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View, type ScrollViewInstance } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, type SharedValue } from "react-native-reanimated";
import type { Application, AppStatus } from "@shared/data/types";
import { STATUS, STATUS_ORDER } from "@shared/data/status";
import { AppText, StatusDot } from "@/components/ui";
import { BoardCard } from "@/components/applications";
import { HeaderButton } from "@/components/header-button";
import { haptic } from "@/lib/haptics";
import { shadow } from "@/theme/tokens";
import { SPRING, SPRING_SNAPPY } from "@/theme/motion";
import { useTheme } from "@/theme/use-theme";

const GAP = 10;
const SIDE = 16;
// How long to hold a card before it lifts, like a Home Screen icon. Shorter holds stay taps and scrolls.
const HOLD_MS = 350;
// Within this distance of a screen edge, a dragged card scrolls the board, faster the closer it gets.
const EDGE = 48;
const MAX_SCROLL_SPEED = 14;

interface Drag {
  app: Application;
  from: number;
}

/**
 * The website's Board: one stage per column, swiped sideways a column at a time. Touch and hold a card to pick it
 * up, drag it onto another column, and let go to move it there, as on the website. Near the screen edge the board
 * scrolls along with it. VoiceOver users move cards with the "Move to another stage" action instead.
 */
export function Board({
  applications,
  onOpen,
  onAdd,
  onMoveTo,
  onMoveMenu,
  onDragChange,
}: {
  applications: Application[];
  onOpen: (app: Application) => void;
  onAdd: (status: AppStatus) => void;
  onMoveTo: (app: Application, status: AppStatus) => void;
  onMoveMenu: (app: Application) => void;
  /** True while a card is being dragged, so the page can stop scrolling under it. */
  onDragChange: (dragging: boolean) => void;
}) {
  const { colors, status: palette } = useTheme();
  const { width } = useWindowDimensions();
  // Wide enough to read a card, narrow enough that the next column peeks in as a hint to swipe.
  const columnWidth = Math.min(320, width * 0.8);
  const step = columnWidth + GAP;

  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollX = useRef(0);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<AppStatus | null>(null);
  // Where the dragged card is drawn, relative to where it was picked up.
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  // Bookkeeping for one drag, read from gesture callbacks and the auto-scroll loop.
  // The dragged app lives here too, so the gesture callbacks never see a stale copy of React state.
  const session = useRef({ app: null as Application | null, scrollAtStart: 0, translationX: 0, absoluteX: 0, over: null as AppStatus | null, frame: 0 });

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(STATUS_ORDER.map((s) => [s, [] as Application[]])) as Record<AppStatus, Application[]>;
    // Soonest deadline first within a column; undated cards after. Same as the website.
    for (const a of [...applications].sort((x, y) => (x.deadline || "9999").localeCompare(y.deadline || "9999"))) map[a.status].push(a);
    return map;
  }, [applications]);

  // The board runs edge to edge, so a finger's x on screen plus the scroll offset is its x on the board.
  const columnAt = (absoluteX: number): AppStatus => {
    const index = Math.floor((absoluteX + scrollX.current - SIDE + GAP / 2) / step);
    return STATUS_ORDER[Math.max(0, Math.min(STATUS_ORDER.length - 1, index))];
  };

  const updateOver = (absoluteX: number) => {
    const target = columnAt(absoluteX);
    if (target !== session.current.over) {
      session.current.over = target;
      setOver(target);
      haptic.select();
    }
  };

  // Keeps the card under the finger when the board scrolls beneath it.
  const placeX = () => dragX.set(session.current.translationX + scrollX.current - session.current.scrollAtStart);

  const autoScroll = () => {
    const s = session.current;
    const maxX = Math.max(0, STATUS_ORDER.length * step - GAP + SIDE * 2 - width);
    const speed = s.absoluteX < EDGE ? -MAX_SCROLL_SPEED * (1 - s.absoluteX / EDGE) : s.absoluteX > width - EDGE ? MAX_SCROLL_SPEED * (1 - (width - s.absoluteX) / EDGE) : 0;
    if (speed !== 0) {
      const next = Math.max(0, Math.min(maxX, scrollX.current + speed));
      if (next !== scrollX.current) {
        scrollX.current = next;
        scrollRef.current?.scrollTo({ x: next, animated: false });
        placeX();
        updateOver(s.absoluteX);
      }
    }
    s.frame = requestAnimationFrame(autoScroll);
  };

  const start = (app: Application, from: number, absoluteX: number) => {
    haptic.lift();
    session.current = { app, scrollAtStart: scrollX.current, translationX: 0, absoluteX, over: app.status, frame: 0 };
    dragX.set(0);
    dragY.set(0);
    setDrag({ app, from });
    setOver(app.status);
    onDragChange(true);
    session.current.frame = requestAnimationFrame(autoScroll);
  };

  const move = (translationX: number, translationY: number, absoluteX: number) => {
    session.current.translationX = translationX;
    session.current.absoluteX = absoluteX;
    placeX();
    dragY.set(translationY);
    updateOver(absoluteX);
  };

  const end = (canceled: boolean) => {
    cancelAnimationFrame(session.current.frame);
    const { app, over: target } = session.current;
    session.current.app = null;
    setDrag(null);
    setOver(null);
    onDragChange(false);
    if (!app || canceled || !target || target === app.status) {
      // Dropped where it started: glide back into place.
      dragX.set(withSpring(0, SPRING));
      dragY.set(withSpring(0, SPRING));
      return;
    }
    dragX.set(0);
    dragY.set(0);
    // Settle the board on the column the card landed in.
    scrollRef.current?.scrollTo({ x: STATUS_ORDER.indexOf(target) * step, animated: true });
    onMoveTo(app, target);
  };

  useEffect(() => () => cancelAnimationFrame(session.current.frame), []);

  const dragging = drag !== null;

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      scrollEnabled={!dragging}
      showsHorizontalScrollIndicator={false}
      snapToInterval={step}
      decelerationRate="fast"
      scrollEventThrottle={16}
      onScroll={(e) => {
        scrollX.current = e.nativeEvent.contentOffset.x;
      }}
      contentContainerStyle={styles.board}
      // Lets the board run to the screen edges past the page padding.
      style={styles.bleed}
    >
      {STATUS_ORDER.map((status, index) => {
        const cards = byStatus[status];
        const isTarget = dragging && over === status && drag.app.status !== status;
        return (
          <View
            key={status}
            accessibilityLabel={`${STATUS[status].label}, ${cards.length}`}
            style={[
              styles.column,
              { width: columnWidth, backgroundColor: palette[status].soft, borderColor: isTarget ? palette[status].mark : "transparent" },
              // The column holding the dragged card draws above its neighbours, so the card can pass over them.
              drag?.from === index && styles.raised,
            ]}
          >
            <View style={styles.columnHeader}>
              <StatusDot status={status} />
              <AppText style={styles.columnTitle}>{STATUS[status].label}</AppText>
              <View style={[styles.count, { backgroundColor: colors.surface }]}>
                <AppText variant="small" style={[styles.countText, { color: palette[status].fg }]}>
                  {cards.length}
                </AppText>
              </View>
              <View style={styles.grow} />
              <HeaderButton icon="plus" label={`Add to ${STATUS[status].label}`} onPress={() => onAdd(status)} />
            </View>
            {cards.map((app) => (
              <DraggableCard
                key={app.id}
                app={app}
                active={drag?.app.id === app.id}
                dragX={dragX}
                dragY={dragY}
                onPress={() => onOpen(app)}
                onMoveMenu={() => onMoveMenu(app)}
                onStart={(absoluteX) => start(app, index, absoluteX)}
                onMove={move}
                onEnd={end}
              />
            ))}
            {(cards.length === 0 || isTarget) && (
              <View style={[styles.emptyColumn, { borderColor: isTarget ? palette[status].mark : colors.lineStrong }]}>
                <AppText variant="small" style={[styles.center, isTarget && { color: palette[status].fg, fontWeight: "600" }]}>
                  {isTarget ? `Drop to move to ${STATUS[status].label}` : STATUS[status].hint}
                </AppText>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

/** A Board card that lifts after a hold and follows the finger. A quick tap still opens it. */
function DraggableCard({
  app,
  active,
  dragX,
  dragY,
  onPress,
  onMoveMenu,
  onStart,
  onMove,
  onEnd,
}: {
  app: Application;
  active: boolean;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  onPress: () => void;
  onMoveMenu: () => void;
  onStart: (absoluteX: number) => void;
  onMove: (translationX: number, translationY: number, absoluteX: number) => void;
  onEnd: (canceled: boolean) => void;
}) {
  const { scheme } = useTheme();
  const reduceMotion = useReducedMotion();
  const lifted = useSharedValue(0);

  useEffect(() => {
    lifted.set(reduceMotion ? (active ? 1 : 0) : withSpring(active ? 1 : 0, SPRING_SNAPPY));
  }, [active, reduceMotion, lifted]);

  const pan = usePanGesture({
    activateAfterLongPress: HOLD_MS,
    runOnJS: true,
    onActivate: (e) => onStart(e.absoluteX),
    onUpdate: (e) => onMove(e.translationX, e.translationY, e.absoluteX),
    onDeactivate: (e) => onEnd(e.canceled),
  });

  const style = useAnimatedStyle(() => {
    const l = lifted.get();
    return {
      // Only the dragged card follows the finger; a dropped card glides back from wherever it was let go.
      transform: [{ translateX: active || l > 0 ? dragX.get() : 0 }, { translateY: active || l > 0 ? dragY.get() : 0 }, { scale: 1 + 0.04 * l }, { rotate: `${2 * l}deg` }],
      opacity: 1 - 0.05 * l,
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[style, active && [styles.raised, shadow("pop", scheme)]]}>
        <BoardCard app={app} onPress={onPress} onMoveMenu={onMoveMenu} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -SIDE },
  board: { paddingHorizontal: SIDE, gap: GAP, alignItems: "flex-start" },
  column: { borderCurve: "continuous", borderRadius: 12, borderWidth: 2, padding: 6, gap: 8, minHeight: 360 },
  raised: { zIndex: 10 },
  columnHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 6, minHeight: 36 },
  columnTitle: { fontWeight: "600" },
  count: { borderCurve: "continuous", borderRadius: 999, paddingHorizontal: 7, minWidth: 22, alignItems: "center" },
  countText: { fontWeight: "600" },
  grow: { flex: 1 },
  emptyColumn: { borderWidth: 1, borderStyle: "dashed", borderCurve: "continuous", borderRadius: 8, paddingVertical: 28, paddingHorizontal: 12 },
  center: { textAlign: "center" },
});
