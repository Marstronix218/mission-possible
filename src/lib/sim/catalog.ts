import partsJson from "../../../data/parts.json";
import categoriesJson from "../../../data/categories.json";

import type { Category, CategoryRules, PartsCatalog } from "../../types/game";

export const partsCatalog = partsJson as PartsCatalog;
export const categoryRules = categoriesJson as Record<Category, CategoryRules>;

export function findPart<T extends { id: string }>(parts: T[], id: string): T | undefined {
  return parts.find((part) => part.id === id);
}
