import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Application, AppStatus } from "../data/types";
import { useData } from "../data/DataContext";
import { STATUS, STATUS_ORDER } from "../data/status";
import { pipelineStats } from "../data/insights";
import { Button, Card, CompanyLogo, cx, DueChip, EmptyState, IconButton, Page, PageHeader, Segmented, StatusDot, Ticker } from "../components/ui";
import { prefersReducedMotion, useFlip } from "../lib/motion";
import { useFeedback, errorMessage } from "../components/feedback";
import { IconBoard, IconMapPin, IconPlus, IconTrendingUp } from "../components/icons";
import SankeyDiagram from "../components/SankeyDiagram";
import Confetti from "../components/Confetti";

interface PipelineProps {
  onNavigate: (screen: string, id?: string) => void;
}

// Kept outside the component so returning to the Board reopens the same view.
let lastView: "board" | "insights" = "board";

export default function Pipeline({ onNavigate }: PipelineProps) {
  const [view, setViewState] = useState(lastView);
  const setView = (v: typeof view) => {
    lastView = v;
    setViewState(v);
  };
  const { applications, updateApplication } = useData();
  const { toast } = useFeedback();
  // The browser only exposes drag data on drop, so the card being dragged is tracked here.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<AppStatus | null>(null);
  // Set when a card is dropped on Offer. `id` restarts the effect if it happens twice in a row.
  const [celebration, setCelebration] = useState<{ id: number; x: number; y: number } | null>(null);
  // Cards glide to their new slot whenever the columns change; a dropped card starts from where it was let go.
  const boardRef = useRef<HTMLDivElement>(null);
  const dropStart = useRef(new Map<string, { left: number; top: number }>());
  const grabOffset = useRef({ x: 0, y: 0 });
  useFlip(boardRef, dropStart);
  // Phones don't do HTML5 drag-and-drop, so touch drags are driven by pointer events: hold a card to pick it up.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const [touchGhost, setTouchGhost] = useState<{ app: Application; width: number; left: number; top: number } | null>(null);
  const cancelTouchDrag = useRef<(() => void) | null>(null);
  const coarsePointer = useMemo(() => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    // Must be registered before the touch starts: browsers decide at touchstart whether a gesture may scroll.
    const blockScroll = (e: TouchEvent) => {
      if (cancelTouchDrag.current && e.cancelable) e.preventDefault();
    };
    scroller.addEventListener("touchmove", blockScroll, { passive: false });
    return () => scroller.removeEventListener("touchmove", blockScroll);
  }, [view]);

  useEffect(() => () => cancelTouchDrag.current?.(), []);

  const startTouchDrag = (app: Application, point: { x: number; y: number }, rect: DOMRect) => {
    const grab = { x: point.x - rect.left, y: point.y - rect.top };
    grabOffset.current = grab;
    setDraggingId(app.id);
    setTouchGhost({ app, width: rect.width, left: rect.left, top: rect.top });
    navigator.vibrate?.(10);

    const session = { x: point.x, y: point.y, over: null as AppStatus | null, raf: 0 };
    const vScroller = verticalScroller(scrollerRef.current);

    const hitTest = () => {
      const column = document.elementFromPoint(session.x, session.y)?.closest<HTMLElement>("[data-column]");
      const over = (column?.dataset.column as AppStatus | undefined) ?? null;
      if (over !== session.over) setOverColumn((session.over = over));
    };
    const onMove = (e: PointerEvent) => {
      session.x = e.clientX;
      session.y = e.clientY;
      if (ghostRef.current) ghostRef.current.style.transform = `translate(${session.x - grab.x}px, ${session.y - grab.y}px)`;
      hitTest();
    };
    // Holding a card near an edge scrolls the board sideways or the page up and down, faster the closer it gets.
    const autoScroll = () => {
      let scrolled = false;
      const h = scrollerRef.current;
      if (h) {
        const r = h.getBoundingClientRect();
        const dx = edgeSpeed(session.x, Math.max(r.left, 0), Math.min(r.right, window.innerWidth));
        if (dx) {
          const before = h.scrollLeft;
          h.scrollLeft += dx;
          scrolled ||= h.scrollLeft !== before;
        }
      }
      const r = vScroller.getBoundingClientRect();
      const dy = edgeSpeed(session.y, Math.max(r.top, 0), Math.min(r.bottom, window.innerHeight));
      if (dy) {
        const before = vScroller.scrollTop;
        vScroller.scrollTop += dy;
        scrolled ||= vScroller.scrollTop !== before;
      }
      // The columns slid under a still finger, so what it's over may have changed.
      if (scrolled) hitTest();
      session.raf = requestAnimationFrame(autoScroll);
    };

    const finish = (drop: boolean) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      cancelAnimationFrame(session.raf);
      cancelTouchDrag.current = null;
      setTouchGhost(null);
      setDraggingId(null);
      setOverColumn(null);
      if (drop && session.over) {
        dropStart.current.set(app.id, { left: session.x - grab.x, top: session.y - grab.y });
        moveTo(app.id, session.over, { x: session.x, y: session.y });
      }
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    cancelTouchDrag.current = onCancel;
    session.raf = requestAnimationFrame(autoScroll);
    hitTest();
  };

  useEffect(() => {
    if (!celebration) return;
    const timer = setTimeout(() => setCelebration(null), 3500);
    return () => clearTimeout(timer);
  }, [celebration?.id]);

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(STATUS_ORDER.map((s) => [s, [] as Application[]])) as Record<AppStatus, Application[]>;
    // Soonest deadline first within a column; undated cards after.
    for (const a of [...applications].sort((x, y) => (x.deadline || "9999").localeCompare(y.deadline || "9999"))) map[a.status].push(a);
    return map;
  }, [applications]);

  const moveTo = async (appId: string, status: AppStatus, point?: { x: number; y: number }) => {
    const app = applications.find((a) => a.id === appId);
    if (!app || app.status === status) return;
    if (status === "offer") {
      setCelebration(point ? { id: Date.now(), ...point } : null);
      toast(`Congrats on the offer from ${app.company}! 🎉`);
    }
    try {
      await updateApplication(appId, { status });
      if (status !== "offer") toast(`${app.company} moved to ${STATUS[status].label}`);
    } catch (e) {
      toast(`Couldn't move ${app.company}: ${errorMessage(e)}`, { tone: "error" });
      setCelebration(null); // don't keep celebrating an offer that didn't save
    }
  };

  const stats = pipelineStats(applications);

  return (
    <Page width="wide">
      <PageHeader
        title="Board"
        description={applications.length === 0 ? "Your applications by stage." : `${stats.total} tracked · ${stats.active} in progress${view === "board" ? (coarsePointer ? " · Press and hold a card to move it" : " · Drag a card to change its stage") : ""}`}
        actions={
          <>
            <Segmented
              label="View"
              value={view}
              onChange={setView}
              options={[
                { value: "board", label: "Board", icon: IconBoard },
                { value: "insights", label: "Insights", icon: IconTrendingUp },
              ]}
            />
            <Button variant="primary" icon={IconPlus} onClick={() => onNavigate("add")}>
              Add application
            </Button>
          </>
        }
      />

      {view === "board" && (
        <div ref={scrollerRef} className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div ref={boardRef} className="grid min-w-[1120px] auto-cols-[minmax(0,1fr)] grid-flow-col gap-2.5">
            {STATUS_ORDER.map((status) => {
              const cards = byStatus[status];
              const dragSource = applications.find((a) => a.id === draggingId);
              const isDropTarget = overColumn === status && !!dragSource && dragSource.status !== status;
              return (
                <section
                  key={status}
                  data-column={status}
                  aria-label={`${STATUS[status].label}, ${cards.length}`}
                  // The whole column accepts drops, not just the cards, so empty columns work too.
                  onDragOver={(e) => {
                    if (!draggingId) return; // ignore files or text dragged in from elsewhere
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (overColumn !== status) setOverColumn(status);
                  }}
                  onDragLeave={(e) => {
                    // dragleave also fires when moving onto a child element; only clear when truly leaving.
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverColumn((c) => (c === status ? null : c));
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = draggingId ?? e.dataTransfer.getData("text/plain");
                    setOverColumn(null);
                    setDraggingId(null);
                    if (id) dropStart.current.set(id, { left: e.clientX - grabOffset.current.x, top: e.clientY - grabOffset.current.y });
                    if (id) moveTo(id, status, { x: e.clientX, y: e.clientY });
                  }}
                  className={cx(
                    "flex min-h-[calc(100dvh-220px)] flex-col rounded-card border p-1.5 transition-[background-color,border-color,box-shadow] duration-150",
                    // Each column wears its stage color, and lights up fully while a card hovers over it.
                    isDropTarget ? STATUS[status].drop : cx("border-transparent", STATUS[status].column),
                  )}
                >
                  <header className="flex h-9 items-center gap-2 pr-0.5 pl-2">
                    <StatusDot status={status} />
                    <h2 className="text-ui font-semibold text-fg">{STATUS[status].label}</h2>
                    <span className={cx("min-w-5 rounded-full px-1.5 text-center text-2xs font-semibold", STATUS[status].badge)}>
                      <Ticker value={cards.length} />
                    </span>
                    <IconButton icon={IconPlus} size="sm" label={`Add to ${STATUS[status].label}`} onClick={() => onNavigate("add", status)} className="ml-auto" />
                  </header>
                  <div className="flex flex-1 flex-col gap-1.5">
                    {cards.map((app) => (
                      <KanbanCard
                        key={app.id}
                        app={app}
                        edge={STATUS[status].edge}
                        onOpen={() => onNavigate("detail", app.id)}
                        isDragging={draggingId === app.id}
                        onDragStart={(offset) => {
                          grabOffset.current = offset;
                          setDraggingId(app.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setOverColumn(null);
                        }}
                        onTouchPickUp={(point, rect) => startTouchDrag(app, point, rect)}
                      />
                    ))}
                    {cards.length === 0 && (
                      <div className={cx("flex flex-1 items-start justify-center rounded-lg border border-dashed px-3 pt-8 text-center text-xs", isDropTarget ? cx("border-current font-medium", STATUS[status].badge.split(" ")[1]) : "border-line-strong/70 text-fg-muted")}>
                        {draggingId ? `Drop to move to ${STATUS[status].label}` : STATUS[status].hint}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {view === "insights" &&
        (stats.total === 0 ? (
          <Card>
            <EmptyState icon={IconTrendingUp} title="No insights yet" description="Add a few applications and this view will show how they flow from submitted to offer." />
          </Card>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-3">
              {[
                { label: "Response rate", value: stats.responseRate, detail: `${stats.heardBack} of ${stats.submitted} submitted heard back` },
                { label: "Interview rate", value: stats.interviewRate, detail: `${stats.interviewed} of ${stats.submitted} submitted reached an interview` },
                { label: "Offer rate", value: stats.offerRate, detail: `${stats.offers} of ${stats.interviewed} interviewed received an offer` },
              ].map((s) => (
                <div key={s.label} className="bg-surface px-4 py-3.5">
                  <p className="text-ui text-fg-muted">{s.label}</p>
                  <p className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] text-fg">{s.value === null ? "—" : `${s.value}%`}</p>
                  <p className="mt-0.5 text-xs text-fg-muted">{s.detail}</p>
                </div>
              ))}
            </div>
            <SankeyDiagram applications={applications} />
          </div>
        ))}

      {/* Respect the OS setting for people who find motion uncomfortable; they still get the message. */}
      {celebration && !prefersReducedMotion() && <Confetti key={celebration.id} x={celebration.x} y={celebration.y} />}

      {/* The card under a touch drag follows the finger; it lives outside the board so the glide animation ignores it. */}
      {touchGhost &&
        createPortal(
          <div
            ref={ghostRef}
            aria-hidden
            className="pointer-events-none fixed top-0 left-0 z-50"
            style={{ width: touchGhost.width, transform: `translate(${touchGhost.left}px, ${touchGhost.top}px)` }}
          >
            <div className={cx("relative rotate-2 overflow-hidden rounded-lg border border-line-strong bg-surface p-3 pl-3.5 shadow-card-hover before:absolute before:inset-y-0 before:left-0 before:w-[3px]", STATUS[touchGhost.app.status].edge)}>
              <CardBody app={touchGhost.app} />
            </div>
          </div>,
          document.body,
        )}
    </Page>
  );
}

const LONG_PRESS_MS = 350;
// A finger that moves further than this before the hold completes is scrolling, not picking up.
const PRESS_SLOP = 8;
const EDGE_ZONE = 56;
const MAX_SCROLL_SPEED = 16;

/** Pixels per frame to scroll when `pos` is within the edge zone of [start, end]: negative toward start, positive toward end. */
function edgeSpeed(pos: number, start: number, end: number) {
  const zone = Math.min(EDGE_ZONE, (end - start) / 4);
  if (pos < start + zone) return -Math.ceil(MAX_SCROLL_SPEED * Math.min(1, (start + zone - pos) / zone));
  if (pos > end - zone) return Math.ceil(MAX_SCROLL_SPEED * Math.min(1, (pos - (end - zone)) / zone));
  return 0;
}

function verticalScroller(el: HTMLElement | null): HTMLElement {
  for (let n = el?.parentElement; n; n = n.parentElement) {
    const { overflowY } = getComputedStyle(n);
    if ((overflowY === "auto" || overflowY === "scroll") && n.scrollHeight > n.clientHeight) return n;
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}


function KanbanCard({ app, edge, onOpen, isDragging, onDragStart, onDragEnd, onTouchPickUp }: { app: Application; edge: string; onOpen: () => void; isDragging: boolean; onDragStart: (grabOffset: { x: number; y: number }) => void; onDragEnd: () => void; onTouchPickUp: (point: { x: number; y: number }, rect: DOMRect) => void }) {
  // Touch and pen get the long-press drag; native dragging is switched off for them so the two don't fight.
  const [touchInput, setTouchInput] = useState(false);
  const press = useRef<{ x: number; y: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  // A release after a pick-up can still fire a click; it shouldn't also open the card.
  const pickedUp = useRef(false);
  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };
  useEffect(() => cancelPress, []);

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={!touchInput}
      data-flip={app.id}
      aria-label={`${app.company}, ${app.position}. Open details`}
      onDragStart={(e) => {
        // Firefox won't start a drag unless some data is set.
        e.dataTransfer.setData("text/plain", app.id);
        e.dataTransfer.effectAllowed = "move";
        const rect = e.currentTarget.getBoundingClientRect();
        onDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      onDragEnd={onDragEnd}
      onPointerDown={(e) => {
        pickedUp.current = false;
        cancelPress();
        const touch = e.pointerType !== "mouse";
        setTouchInput(touch);
        if (!touch || !e.isPrimary) return;
        const el = e.currentTarget;
        const point = { x: e.clientX, y: e.clientY };
        press.current = {
          ...point,
          timer: setTimeout(() => {
            press.current = null;
            pickedUp.current = true;
            onTouchPickUp(point, el.getBoundingClientRect());
          }, LONG_PRESS_MS),
        };
      }}
      onPointerMove={(e) => {
        const p = press.current;
        if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > PRESS_SLOP) cancelPress();
      }}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
      // Long-press would otherwise open the browser's own menu on Android.
      onContextMenu={(e) => touchInput && e.preventDefault()}
      onClick={() => {
        if (pickedUp.current) {
          pickedUp.current = false;
          return;
        }
        onOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      title="Click to open · drag to change stage"
      className={cx(
        "group relative cursor-grab overflow-hidden rounded-lg border border-line bg-surface p-3 pl-3.5 shadow-xs select-none [-webkit-touch-callout:none] before:absolute before:inset-y-0 before:left-0 before:w-[3px]",
        edge,
        "lift hover:border-line-strong hover:shadow-card-hover active:cursor-grabbing",
        // The card left behind becomes a quiet placeholder while its ghost is dragged around.
        isDragging && "border-dashed border-line-strong opacity-45 shadow-none",
      )}
    >
      <CardBody app={app} />
    </div>
  );
}

function CardBody({ app }: { app: Application }) {
  const completed = app.interviewStages.filter((s) => s.completed).length;
  const showDeadline = app.deadline && (app.status === "wishlist" || app.status === "applied");
  return (
    <>
      <div className="flex items-start gap-2.5">
        <CompanyLogo name={app.company} initials={app.logoInitials} color={app.logoColor} size={28} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-ui font-medium text-fg">{app.company}</p>
          <p className="line-clamp-2 text-xs leading-snug text-fg-muted">{app.position}</p>
        </div>
      </div>

      {(app.location || showDeadline || app.salary) && (
        <div className="mt-2.5 flex items-center gap-2 text-xs text-fg-muted">
          {app.location && (
            <span className="flex min-w-0 items-center gap-1">
              <IconMapPin size={12} className="text-fg-faint" />
              <span className="truncate">{app.location}</span>
            </span>
          )}
          {showDeadline ? <DueChip date={app.deadline} className="ml-auto shrink-0" /> : app.salary && <span className="ml-auto shrink-0 tabular-nums">{app.salary}</span>}
        </div>
      )}

      {app.interviewStages.length > 0 && (
        <div className="mt-2.5 flex items-center gap-2" title={app.interviewStages.map((s) => `${s.completed ? "✓" : "○"} ${s.name}`).join("\n")}>
          <div className="flex flex-1 gap-[2px]">
            {app.interviewStages.map((stage) => (
              <span key={stage.id} className={cx("h-1 flex-1 rounded-full", stage.completed ? "bg-status-interviewing" : "bg-muted-strong")} />
            ))}
          </div>
          <span className="text-2xs text-fg-muted tabular-nums">
            {completed}/{app.interviewStages.length} rounds
          </span>
        </div>
      )}
    </>
  );
}
