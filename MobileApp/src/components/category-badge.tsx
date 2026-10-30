import { CATEGORY_LABEL, type CareerCategory } from "@shared/data/careerLog";
import { Badge } from "@/components/ui";

// Same tones as the website's Career log.
const CATEGORY_TONE: Record<CareerCategory, "success" | "accent" | "warning" | "neutral"> = {
  accomplishment: "success",
  project: "accent",
  feedback: "warning",
  skill: "neutral",
  milestone: "neutral",
};

export function CategoryBadge({ category }: { category: CareerCategory }) {
  return <Badge tone={CATEGORY_TONE[category]}>{CATEGORY_LABEL[category]}</Badge>;
}
