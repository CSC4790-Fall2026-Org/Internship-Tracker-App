import type { SFSymbol } from "expo-symbols";
import { Card, EmptyState, Screen } from "@/components/ui";

/** Placeholder for a tab that a later phase of DEVELOPMENT_PLAN.md builds out. */
export function ComingSoon({ title, icon, description }: { title: string; icon: SFSymbol; description: string }) {
  return (
    <Screen title={title}>
      <Card>
        <EmptyState icon={icon} title="Coming soon" description={description} />
      </Card>
    </Screen>
  );
}
