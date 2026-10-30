import type { SFSymbol } from "expo-symbols";
import type { ItemKind } from "@shared/data/insights";

/** A glyph per calendar kind, alongside its color (theme kind colors) so kinds stay distinct without relying on hue. */
export const KIND_ICON: Record<ItemKind, SFSymbol> = { interview: "bubble.left", deadline: "flag", task: "checklist", event: "calendar" };

/** Display order, same as the website's Calendar legend. */
export const KIND_ORDER: ItemKind[] = ["deadline", "interview", "event", "task"];
