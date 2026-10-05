import type { FacingRule, PlacementPreference } from "./planogram-optimizer";
import type { ShelfRecord } from "./shelf-configuration";

export type SavedPlanogram = {
  id: string;
  name: string;
  shelf: ShelfRecord;
  rules: FacingRule[];
  placements: PlacementPreference[][];
  instruction: string;
  createdAt: string;
  updatedAt: string;
};

export const PLANOGRAM_STORAGE_KEY = "shelfwise.planograms.v1";
export const PENDING_PLANOGRAM_KEY = "shelfwise.planogram-to-open.v1";
export const PENDING_SHELF_KEY = "shelfwise.shelf-to-open.v1";

export function readPlanograms(): SavedPlanogram[] {
  try {
    const value = window.localStorage.getItem(PLANOGRAM_STORAGE_KEY);
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as SavedPlanogram[] : [];
  } catch { return []; }
}

export function writePlanograms(planograms: SavedPlanogram[]) {
  window.localStorage.setItem(PLANOGRAM_STORAGE_KEY, JSON.stringify(planograms));
}

export function savePlanogram(planogram: SavedPlanogram) {
  const existing = readPlanograms();
  const index = existing.findIndex(item => item.id === planogram.id);
  if (index >= 0) existing[index] = planogram;
  else existing.unshift(planogram);
  writePlanograms(existing);
  return existing;
}
