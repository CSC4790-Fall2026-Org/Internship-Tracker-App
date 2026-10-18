import type { AppStatus } from "./types";

// The single source for how each pipeline stage is named and colored. Class strings are spelled out in full
// so Tailwind can see them; `mark` is the CSS variable for SVG fills.
export const STATUS_ORDER: AppStatus[] = ["wishlist", "applied", "interviewing", "offer", "rejected"];

export const STATUS: Record<
  AppStatus,
  {
    label: string;
    hint: string;
    dot: string;
    badge: string;
    mark: string;
    /** Board column at rest, and lit up while a card is dragged over it. */
    column: string;
    drop: string;
    /** Colored leading edge on board cards. */
    edge: string;
  }
> = {
  wishlist: {
    label: "Wishlist",
    hint: "Saved, not applied yet",
    dot: "border-[1.5px] border-status-wishlist bg-transparent",
    badge: "bg-status-wishlist-soft text-status-wishlist-fg",
    mark: "var(--color-status-wishlist)",
    column: "bg-status-wishlist-soft/60",
    drop: "border-status-wishlist bg-status-wishlist-soft ring-4 ring-status-wishlist/20",
    edge: "before:bg-status-wishlist",
  },
  applied: {
    label: "Applied",
    hint: "Submitted, waiting to hear back",
    dot: "bg-status-applied",
    badge: "bg-status-applied-soft text-status-applied-fg",
    mark: "var(--color-status-applied)",
    column: "bg-status-applied-soft/45",
    drop: "border-status-applied bg-status-applied-soft ring-4 ring-status-applied/20",
    edge: "before:bg-status-applied",
  },
  interviewing: {
    label: "Interviewing",
    hint: "In interview rounds",
    dot: "bg-status-interviewing",
    badge: "bg-status-interviewing-soft text-status-interviewing-fg",
    mark: "var(--color-status-interviewing)",
    column: "bg-status-interviewing-soft/45",
    drop: "border-status-interviewing bg-status-interviewing-soft ring-4 ring-status-interviewing/20",
    edge: "before:bg-status-interviewing",
  },
  offer: {
    label: "Offer",
    hint: "Offer received",
    dot: "bg-status-offer",
    badge: "bg-status-offer-soft text-status-offer-fg",
    mark: "var(--color-status-offer)",
    column: "bg-status-offer-soft/45",
    drop: "border-status-offer bg-status-offer-soft ring-4 ring-status-offer/20",
    edge: "before:bg-status-offer",
  },
  rejected: {
    label: "Closed",
    hint: "Rejected or withdrawn",
    dot: "bg-status-rejected",
    badge: "bg-status-rejected-soft text-status-rejected-fg",
    mark: "var(--color-status-rejected)",
    column: "bg-status-rejected-soft/60",
    drop: "border-status-rejected bg-status-rejected-soft ring-4 ring-status-rejected/20",
    edge: "before:bg-status-rejected",
  },
};
