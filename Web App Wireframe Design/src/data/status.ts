import type { AppStatus } from "./types";

// The single source for how each pipeline stage is named and colored. Class strings are spelled out in full
// so Tailwind can see them; `mark` is the CSS variable for SVG fills.
export const STATUS_ORDER: AppStatus[] = ["wishlist", "applied", "interviewing", "offer", "rejected"];

export const STATUS: Record<AppStatus, { label: string; hint: string; dot: string; badge: string; mark: string }> = {
  wishlist: {
    label: "Wishlist",
    hint: "Saved, not applied yet",
    dot: "border-[1.5px] border-status-wishlist bg-transparent",
    badge: "bg-status-wishlist-soft text-status-wishlist-fg",
    mark: "var(--color-status-wishlist)",
  },
  applied: {
    label: "Applied",
    hint: "Submitted, waiting to hear back",
    dot: "bg-status-applied",
    badge: "bg-status-applied-soft text-status-applied-fg",
    mark: "var(--color-status-applied)",
  },
  interviewing: {
    label: "Interviewing",
    hint: "In interview rounds",
    dot: "bg-status-interviewing",
    badge: "bg-status-interviewing-soft text-status-interviewing-fg",
    mark: "var(--color-status-interviewing)",
  },
  offer: {
    label: "Offer",
    hint: "Offer received",
    dot: "bg-status-offer",
    badge: "bg-status-offer-soft text-status-offer-fg",
    mark: "var(--color-status-offer)",
  },
  rejected: {
    label: "Closed",
    hint: "Rejected or withdrawn",
    dot: "bg-status-rejected",
    badge: "bg-status-rejected-soft text-status-rejected-fg",
    mark: "var(--color-status-rejected)",
  },
};
