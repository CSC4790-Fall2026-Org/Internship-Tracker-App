import { useEffect, useMemo, useState } from "react";
import type { Application, AppStatus } from "../data/types";
import { useData } from "../data/DataContext";
import { STATUS, STATUS_ORDER } from "../data/status";
import { pipelineStats } from "../data/insights";
import { Button, Card, CompanyLogo, cx, DueChip, EmptyState, IconButton, Page, PageHeader, Segmented, StatusDot } from "../components/ui";
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
        description={applications.length === 0 ? "Your applications by stage." : `${stats.total} tracked · ${stats.active} in progress${view === "board" ? " · Drag a card to change its stage" : ""}`}
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
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="grid min-w-max auto-cols-[minmax(216px,1fr)] grid-flow-col gap-2.5">
            {STATUS_ORDER.map((status) => {
              const cards = byStatus[status];
              const dragSource = applications.find((a) => a.id === draggingId);
              const isDropTarget = overColumn === status && !!dragSource && dragSource.status !== status;
              return (
                <section
                  key={status}
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
                    if (id) moveTo(id, status, { x: e.clientX, y: e.clientY });
                  }}
                  className={cx(
                    "flex min-h-[calc(100dvh-220px)] flex-col rounded-card border p-1.5 transition-[background-color,border-color] duration-150",
                    isDropTarget ? "border-accent/40 bg-accent-soft/60" : "border-transparent bg-muted/60",
                  )}
                >
                  <header className="flex h-9 items-center gap-2 pr-0.5 pl-2">
                    <StatusDot status={status} />
                    <h2 className="text-ui font-semibold text-fg">{STATUS[status].label}</h2>
                    <span className="text-xs text-fg-muted tabular-nums">{cards.length}</span>
                    <IconButton icon={IconPlus} size="sm" label={`Add to ${STATUS[status].label}`} onClick={() => onNavigate("add", status)} className="ml-auto" />
                  </header>
                  <div className="flex flex-1 flex-col gap-1.5">
                    {cards.map((app) => (
                      <KanbanCard
                        key={app.id}
                        app={app}
                        onOpen={() => onNavigate("detail", app.id)}
                        isDragging={draggingId === app.id}
                        onDragStart={() => setDraggingId(app.id)}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setOverColumn(null);
                        }}
                      />
                    ))}
                    {cards.length === 0 && (
                      <div className={cx("flex flex-1 items-start justify-center rounded-lg border border-dashed px-3 pt-8 text-center text-xs", isDropTarget ? "border-accent/40 text-accent-fg" : "border-line-strong/70 text-fg-muted")}>
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

      {celebration && !prefersReducedMotion() && <Confetti key={celebration.id} x={celebration.x} y={celebration.y} />}
    </Page>
  );
}

// Respect the OS setting for people who find motion uncomfortable; they still get the message.
function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function KanbanCard({ app, onOpen, isDragging, onDragStart, onDragEnd }: { app: Application; onOpen: () => void; isDragging: boolean; onDragStart: () => void; onDragEnd: () => void }) {
  const completed = app.interviewStages.filter((s) => s.completed).length;
  const showDeadline = app.deadline && (app.status === "wishlist" || app.status === "applied");
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      aria-label={`${app.company}, ${app.position}. Open details`}
      onDragStart={(e) => {
        // Firefox won't start a drag unless some data is set.
        e.dataTransfer.setData("text/plain", app.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      title="Click to open · drag to change stage"
      className={cx(
        "group cursor-grab rounded-lg border border-line bg-surface p-3 shadow-xs transition-[box-shadow,border-color,opacity] duration-150 hover:border-line-strong hover:shadow-card-hover active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
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
    </div>
  );
}
