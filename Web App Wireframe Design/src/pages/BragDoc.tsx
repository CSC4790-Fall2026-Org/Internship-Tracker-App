import { useEffect, useMemo, useState } from "react";
import { CAREER_CATEGORIES, fetchCareerLog, type CareerCategory, type CareerLogEntry } from "../data/careerLog";
import { BRAG_CATEGORIES, bragDocMarkdown, bragDocText, bragSections, type BragPeriod } from "../data/bragDoc";
import { formatDate } from "../data/dates";
import { useData } from "../data/DataContext";
import { Banner, Button, Card, cx, EmptyState, Page, PageHeader, Segmented, Skeleton } from "../components/ui";
import { useFeedback } from "../components/feedback";
import { IconAlertCircle, IconArrowRight, IconCopy, IconRefresh, IconTrophy } from "../components/icons";

const PERIODS: { value: BragPeriod; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

export default function BragDoc({ onNavigate }: { onNavigate: (screen: string, id?: string) => void }) {
  const { applications } = useData();
  const { toast } = useFeedback();
  const [entries, setEntries] = useState<CareerLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [period, setPeriod] = useState<BragPeriod>("quarter");
  const [categories, setCategories] = useState<CareerCategory[]>(BRAG_CATEGORIES);

  const load = () => {
    setLoading(true);
    fetchCareerLog()
      .then((rows) => {
        setEntries(rows);
        setLoadError(null);
      })
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const companyById = useMemo(() => new Map(applications.map((a) => [a.id, a.company])), [applications]);
  const companyOf = (id: string) => companyById.get(id);

  const eligible = useMemo(() => entries.filter((e) => BRAG_CATEGORIES.includes(e.category)), [entries]);
  const sections = useMemo(() => bragSections(eligible, period, categories), [eligible, period, categories]);
  const shownCount = sections.reduce((n, s) => n + s.count, 0);

  const counts = useMemo(() => {
    const out = {} as Record<CareerCategory, number>;
    for (const c of BRAG_CATEGORIES) out[c] = 0;
    for (const e of eligible) out[e.category]++;
    return out;
  }, [eligible]);

  // Keep at least one category on, so the doc never goes blank by accident.
  const toggleCategory = (c: CareerCategory) =>
    setCategories((current) => (current.includes(c) ? (current.length > 1 ? current.filter((x) => x !== c) : current) : BRAG_CATEGORIES.filter((x) => x === c || current.includes(x))));

  const copy = async (format: "text" | "markdown") => {
    const content = format === "markdown" ? bragDocMarkdown(sections, companyOf) : bragDocText(sections, companyOf);
    try {
      await navigator.clipboard.writeText(content);
      toast(format === "markdown" ? "Copied as Markdown" : "Copied as text");
    } catch {
      toast("Couldn't reach the clipboard. Check your browser's permissions and try again.", { tone: "error" });
    }
  };

  const ready = !loading && !loadError && eligible.length > 0;

  return (
    <Page width="narrow">
      <PageHeader
        title="Brag doc"
        description={ready ? `${shownCount} ${shownCount === 1 ? "entry" : "entries"} from your career log, grouped by ${period}` : "Accomplishments, projects and feedback from your career log, ready to paste into a review or resume."}
        actions={
          ready && (
            <>
              <Button icon={IconCopy} onClick={() => copy("text")}>
                Copy text
              </Button>
              <Button variant="primary" icon={IconCopy} onClick={() => copy("markdown")}>
                Copy Markdown
              </Button>
            </>
          )
        }
      />

      {loadError ? (
        <Banner
          icon={IconAlertCircle}
          action={
            <Button size="sm" icon={IconRefresh} onClick={load}>
              Retry
            </Button>
          }
        >
          Couldn't load your career log: {loadError}
        </Banner>
      ) : loading ? (
        <Card className="space-y-3 p-4" role="status" aria-label="Loading your brag doc">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-2/3" />
        </Card>
      ) : eligible.length === 0 ? (
        <Card>
          <EmptyState
            icon={IconTrophy}
            title="Nothing for your brag doc yet"
            description="It's built from the accomplishments, projects and feedback in your career log. Log a few and they'll show up here."
            actions={
              <Button variant="primary" onClick={() => onNavigate("career-log")}>
                Go to career log
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div role="group" aria-label="Include categories" className="flex flex-wrap gap-1.5">
              {CAREER_CATEGORIES.filter((c) => BRAG_CATEGORIES.includes(c.value)).map((c) => {
                const active = categories.includes(c.value);
                return (
                  <button
                    key={c.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleCategory(c.value)}
                    className={cx(
                      "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-ui font-medium transition-colors",
                      active ? "border-ink bg-ink text-on-ink" : "border-line bg-surface text-fg-2 hover:border-line-strong hover:text-fg",
                    )}
                  >
                    {c.plural}
                    <span className={cx("text-2xs tabular-nums", active ? "text-on-ink/70" : "text-fg-muted")}>{counts[c.value]}</span>
                  </button>
                );
              })}
            </div>
            <Segmented label="Group by" value={period} onChange={setPeriod} options={PERIODS} />
          </div>

          <Card className="overflow-hidden">
            {sections.map((section) => (
              <section key={section.key} aria-labelledby={`brag-${section.key}`} className="border-b border-line px-5 py-5 last:border-b-0 sm:px-6">
                <div className="mb-4 flex items-baseline justify-between gap-3">
                  <h2 id={`brag-${section.key}`} className="text-base font-semibold tracking-[-0.01em] text-fg">
                    {section.label}
                  </h2>
                  <span className="text-ui text-fg-muted tabular-nums">
                    {section.count} {section.count === 1 ? "entry" : "entries"}
                  </span>
                </div>
                <div className="space-y-5">
                  {section.groups.map((group) => (
                    <div key={group.category}>
                      <h3 className="mb-2 text-xs font-medium text-fg-muted">{group.label}</h3>
                      <ul className="space-y-3.5">
                        {group.entries.map((entry) => {
                          const company = entry.applicationId ? companyOf(entry.applicationId) : undefined;
                          return (
                            <li key={entry.id} className="flex gap-3">
                              <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-fg-faint" aria-hidden="true" />
                              <div className="min-w-0 flex-1">
                                <p className="text-[15px] leading-relaxed text-fg">
                                  <span className="font-medium">{entry.title}</span>
                                  <span className="text-fg-muted">
                                    {" "}
                                    · {formatDate(entry.date)}
                                    {company && ` · ${company}`}
                                  </span>
                                </p>
                                {entry.impact && (
                                  <p className="mt-1 text-sm leading-relaxed text-fg-2">
                                    <span className="font-medium">Impact:</span> {entry.impact}
                                  </p>
                                )}
                                {entry.details && <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-fg-muted">{entry.details}</p>}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </Card>

          <p className="mt-3 flex flex-wrap items-center gap-x-1.5 px-1 text-xs text-fg-muted">
            Edit or remove entries in the career log and this updates to match.
            <button type="button" onClick={() => onNavigate("career-log")} className="group inline-flex items-center gap-1 font-medium text-fg-2 hover:text-fg">
              Open career log <IconArrowRight size={13} className="transition-transform duration-200 ease-snappy group-hover:translate-x-0.5" />
            </button>
          </p>
        </>
      )}
    </Page>
  );
}
