import { StyleSheet, View } from "react-native";
import type { Application } from "@shared/data/types";
import { pipelineStats } from "@shared/data/insights";
import { AppText, Card, EmptyState } from "@/components/ui";
import { SankeyDiagram } from "@/components/charts";
import { useTheme } from "@/theme/use-theme";

/** The website Board's Insights view: three conversion rates, then where every application has ended up. */
export function Insights({ applications }: { applications: Application[] }) {
  const { colors } = useTheme();
  const stats = pipelineStats(applications);

  if (stats.total === 0) {
    return (
      <Card>
        <EmptyState icon="chart.line.uptrend.xyaxis" title="No insights yet" description="Add a few applications and this view will show how they flow from submitted to offer." />
      </Card>
    );
  }

  const rates = [
    { label: "Response rate", value: stats.responseRate, detail: `${stats.heardBack} of ${stats.submitted} submitted heard back` },
    { label: "Interview rate", value: stats.interviewRate, detail: `${stats.interviewed} of ${stats.submitted} submitted reached an interview` },
    { label: "Offer rate", value: stats.offerRate, detail: `${stats.offers} of ${stats.interviewed} interviewed received an offer` },
  ];

  return (
    <>
      <Card style={styles.rates}>
        {rates.map((rate, i) => (
          <View key={rate.label} style={[styles.rate, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }]}>
            <View style={styles.grow}>
              <AppText variant="muted">{rate.label}</AppText>
              <AppText variant="small">{rate.detail}</AppText>
            </View>
            <AppText style={styles.rateValue}>{rate.value === null ? "—" : `${rate.value}%`}</AppText>
          </View>
        ))}
      </Card>
      <Card>
        <View>
          <AppText variant="heading">Application flow</AppText>
          <AppText variant="small">{"Where each application you've tracked has ended up so far."}</AppText>
        </View>
        <SankeyDiagram applications={applications} />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  rates: { padding: 0, gap: 0 },
  rate: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  grow: { flex: 1 },
  rateValue: { fontSize: 24, lineHeight: 30, fontWeight: "600", letterSpacing: -0.5, fontVariant: ["tabular-nums"] },
});
