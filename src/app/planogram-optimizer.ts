import type { Product } from "./product-catalog";
import type { ShelfRecord } from "./shelf-configuration";

export type FacingRule = { productId: string; min: number; max: number; priority: "low" | "standard" | "high" };
export type PlacementPreference = { product: Product; productId: string; level: number; facings: number; x: number };
export type UnplacedProduct = { product: Product; reason: string };
export type OptimizationResult = { feasible: boolean; placements: PlacementPreference[][]; unplaced: UnplacedProduct[]; totalFacings: number; usedWidth: number[]; explanation: string };
export type ParsedPreferences = { boostedProductIds: Set<string>; eyeLevelProductIds: Set<string>; topProductIds: Set<string>; bottomProductIds: Set<string>; velocityFocus: boolean; balanced: boolean; recognized: string[] };

const priorityWeight = { low: 0.7, standard: 1, high: 1.5 };
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Maps simple merchandising phrases to explicit product and shelf-level preferences. */
export function parseMerchandisingInstruction(text: string, products: Product[]): ParsedPreferences {
  const instruction = normalize(text);
  const recognized: string[] = [];
  const boostedProductIds = new Set<string>();
  const eyeLevelProductIds = new Set<string>();
  const topProductIds = new Set<string>();
  const bottomProductIds = new Set<string>();
  const wantsBoost = /\b(prioritiz\w*|focus on|feature|promot\w*|emphasiz\w*|prominent|more space|more facings|give .* more|favor|favour|increase .* facings)\b/.test(instruction);
  const atEye = /\b(eye level|eye height|eye shelf)\b/.test(instruction);
  const atTop = /\b(top shelf|upper shelf|top level)\b/.test(instruction);
  const atBottom = /\b(bottom shelf|lower shelf|bottom level|heavy .* bottom)\b/.test(instruction);
  const named = products.filter(product => {
    const terms = [product.category, product.brand, product.name].map(normalize).filter(term => term.length >= 3);
    return terms.some(term => instruction.includes(term));
  });
  if (wantsBoost) {
    named.forEach(product => boostedProductIds.add(product.id));
    if (named.length) recognized.push(`Extra placement weight for ${[...new Set(named.map(p => p.category))].join(", ")}`);
  }
  if (atEye && named.length) {
    named.forEach(product => eyeLevelProductIds.add(product.id));
    recognized.push("Eye-level placement for the named products");
  } else if (atEye && !named.length) recognized.push("Eye-level preference noted; layout favors eye-height placements where practical");
  if (atTop && named.length) { named.forEach(product => topProductIds.add(product.id)); recognized.push("Upper shelf preference for the named products"); }
  if (atBottom && named.length) { named.forEach(product => bottomProductIds.add(product.id)); recognized.push("Lower shelf preference for the named products"); }
  const velocityFocus = /\b(top sellers|best sellers|fast moving|fast movers|high velocity|top selling|sell fastest)\b/.test(instruction);
  if (velocityFocus) recognized.push("Sales velocity receives additional weight");
  const balanced = /\b(balanced|spread evenly|even distribution|balance facings)\b/.test(instruction);
  if (balanced) recognized.push("Facings are spread more evenly across selected products");
  return { boostedProductIds, eyeLevelProductIds, topProductIds, bottomProductIds, velocityFocus, balanced, recognized };
}

function priorityOf(rule: FacingRule, product: Product, preferences: ParsedPreferences): number {
  let weight = priorityWeight[rule.priority];
  if (preferences.boostedProductIds.has(product.id)) weight *= 1.6;
  if (preferences.velocityFocus) weight *= 1.25;
  return weight;
}

function levelPreference(product: Product, level: number, shelf: ShelfRecord, preferences: ParsedPreferences): number {
  const mid = (shelf.levelHeights.length - 1) / 2;
  const center = 1 - Math.abs(level - mid) / Math.max(1, mid + 1);
  if (preferences.eyeLevelProductIds.has(product.id)) return center * 4;
  if (preferences.topProductIds.has(product.id)) return (shelf.levelHeights.length - level) / shelf.levelHeights.length * 3;
  if (preferences.bottomProductIds.has(product.id)) return (level + 1) / shelf.levelHeights.length * 3;
  return center * 0.04;
}

/** Deterministic dimensional placement with a bounded backtracking pass for minimum facings. */
export function optimizePlanogram(shelf: ShelfRecord, products: Product[], rules: FacingRule[], preferences: ParsedPreferences): OptimizationResult {
  const productById = new Map(products.map(product => [product.id, product]));
  const unplaced: UnplacedProduct[] = [];
  const selected = rules.flatMap(rule => {
    const product = productById.get(rule.productId);
    if (!product) return [];
    const reasons: string[] = [];
    if (product.depth > shelf.depth) reasons.push(`Product depth ${product.depth}″ exceeds shelf depth ${shelf.depth}″`);
    if (!shelf.levelHeights.some(height => product.height <= height)) reasons.push(`Product height ${product.height}″ exceeds every level's clear height`);
    if (product.width * rule.min > shelf.width) reasons.push(`Minimum ${rule.min} facing${rule.min === 1 ? "" : "s"} needs ${product.width * rule.min}″ of width, but the shelf is ${shelf.width}″ wide`);
    if (rule.min < 1 || rule.max < rule.min || rule.max > 50) reasons.push("Facing limits must be between 1 and 50, with maximum at least the minimum");
    if (reasons.length) { unplaced.push({ product, reason: reasons.join("; ") }); return []; }
    return [{ product, rule, weight: priorityOf(rule, product, preferences) }];
  });

  const ordered = [...selected].sort((a, b) => (b.product.width * b.rule.min - a.product.width * a.rule.min) || b.weight - a.weight || a.product.sku.localeCompare(b.product.sku));
  const placements: PlacementPreference[][] = shelf.levelHeights.map(() => []);
  const remaining = shelf.levelHeights.map(() => shelf.width);
  let explored = 0;
  const searchLimit = 30000;
  function assign(index: number): boolean {
    if (index >= ordered.length) return true;
    if (++explored > searchLimit) return false;
    const item = ordered[index];
    const needed = item.product.width * item.rule.min;
    const candidates = shelf.levelHeights.map((height, level) => ({ level, height, space: remaining[level] })).filter(candidate => item.product.height <= candidate.height && needed <= candidate.space + 1e-8).sort((a, b) => {
      const pref = levelPreference(item.product, b.level, shelf, preferences) - levelPreference(item.product, a.level, shelf, preferences);
      return pref || (a.space - needed) - (b.space - needed) || a.level - b.level;
    });
    let lastEquivalent = "";
    for (const candidate of candidates) {
      const symmetryKey = `${candidate.height}:${candidate.space.toFixed(5)}`;
      if (lastEquivalent === symmetryKey) continue;
      lastEquivalent = symmetryKey;
      remaining[candidate.level] -= needed;
      placements[candidate.level].push({ product: item.product, productId: item.product.id, level: candidate.level, facings: item.rule.min, x: 0 });
      if (assign(index + 1)) return true;
      placements[candidate.level].pop(); remaining[candidate.level] += needed;
    }
    return false;
  }

  const fullyPlaced = assign(0);
  if (!fullyPlaced && selected.length) {
    placements.forEach(level => { level.length = 0; });
    remaining.forEach((_, level) => { remaining[level] = shelf.width; });
    explored = 0;
    for (const item of ordered) {
      const need = item.product.width * item.rule.min;
      const level = shelf.levelHeights.map((height, i) => ({ height, i, space: remaining[i] })).filter(option => item.product.height <= option.height && need <= option.space + 1e-8).sort((a, b) => (levelPreference(item.product, b.i, shelf, preferences) - levelPreference(item.product, a.i, shelf, preferences)) || (a.space - need) - (b.space - need) || a.i - b.i)[0];
      if (level) { remaining[level.i] -= need; placements[level.i].push({ product: item.product, productId: item.product.id, level: level.i, facings: item.rule.min, x: 0 }); }
      else unplaced.push({ product: item.product, reason: `Minimum facing requirements cannot be placed in the remaining shelf capacity` });
    }
  }

  // Allocate additional facings by weighted marginal sales value per inch.
  const ruleMap = new Map(rules.map(rule => [rule.productId, rule]));
  for (let pass = 0; pass < 1000; pass++) {
    let choice: { item: PlacementPreference; level: number; rule: FacingRule; score: number } | undefined;
    for (let level = 0; level < placements.length; level++) for (const item of placements[level]) {
      const rule = ruleMap.get(item.product.id)!;
      if (item.facings >= rule.max || item.product.width > remaining[level] + 1e-8) continue;
      const base = priorityOf(rule, item.product, preferences) * (item.product.velocity + 0.1);
      const dilution = preferences.balanced ? Math.sqrt(item.facings) : item.facings;
      const score = base / (dilution * item.product.width);
      if (!choice || score > choice.score + 1e-10 || (Math.abs(score - choice.score) < 1e-10 && item.product.sku.localeCompare(choice.item.product.sku) < 0)) choice = { item, level, rule, score };
    }
    if (!choice) break;
    choice.item.facings += 1; remaining[choice.level] -= choice.item.product.width;
  }

  for (let level = 0; level < placements.length; level++) {
    placements[level].sort((a, b) => priorityOf(ruleMap.get(b.product.id)!, b.product, preferences) - priorityOf(ruleMap.get(a.product.id)!, a.product, preferences) || b.product.velocity - a.product.velocity || a.product.sku.localeCompare(b.product.sku));
    let x = 0;
    for (const item of placements[level]) { item.x = x; x += item.product.width * item.facings; }
  }
  const totalFacings = placements.flat().reduce((sum, item) => sum + item.facings, 0);
  const feasible = unplaced.length === 0;
  const explanation = feasible
    ? `${selected.length} selected product${selected.length === 1 ? "" : "s"} fit across ${shelf.levelHeights.length} shelf levels. Additional facings were assigned by weighted sales velocity, placement priority, and available width.`
    : `${unplaced.length} selected product${unplaced.length === 1 ? "" : "s"} could not be placed while respecting the dimensions and minimum facings.`;
  return { feasible, placements, unplaced, totalFacings, usedWidth: placements.map((level, index) => shelf.width - remaining[index]), explanation };
}
