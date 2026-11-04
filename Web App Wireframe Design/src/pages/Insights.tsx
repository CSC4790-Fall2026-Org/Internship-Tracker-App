import { useData } from "../data/DataContext";
import { pipelineStats } from "../data/insights";
import { Button, Card, EmptyState, Page, PageHeader } from "../components/ui";
import { IconPlus, IconTrendingUp } from "../components/icons";
import SankeyDiagram from "../components/SankeyDiagram";

interface InsightsProps {
  onNavigate: (screen: string, id?: string) => void;
}

export default function Insights({ onNavigate }: InsightsProps) {
  const { applications } = useData();
  const stats = pipelineStats(applications);

  return (
    <Page width="wide">
      <PageHeader title="Insights" description={stats.total === 0 ? "How your applications move from submitted to offer." : `${stats.total} tracked · ${stats.active} in progress`} />

      {stats.total === 0 ? (
        <Card>
          <EmptyState
            icon={IconTrendingUp}
            title="No insights yet"
            description="Add a few applications and this view will show how they flow from submitted to offer."
            actions={
              <Button variant="primary" icon={IconPlus} onClick={() => onNavigate("add")}>
                Add application
              </Button>
            }
          />
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
      )}
    </Page>
  );
}
