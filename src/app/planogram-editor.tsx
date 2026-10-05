"use client";

import { DragEvent, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Box, Check, GripVertical, LayoutGrid, Minus, Plus, Trash2 } from "lucide-react";
import type { Product } from "./product-catalog";
import type { ShelfRecord } from "./shelf-configuration";
import type { FacingRule, OptimizationResult, PlacementPreference } from "./planogram-optimizer";
import Shelf3DView from "./shelf-3d-view";

type DragInfo = { productId: string; fromLevel: number };
type Props = { shelf: ShelfRecord; result: OptimizationResult; rules: FacingRule[]; onResultChange: (result: OptimizationResult) => void; onRulesChange: (rules: FacingRule[]) => void };
const palette = ["#d9b157", "#dc806f", "#79ab91", "#7593ca", "#a58bc0", "#ca7f91", "#6ba5ac", "#b39668"];
function color(product: Product) { let hash = 0; for (const c of product.sku) hash = c.charCodeAt(0) + ((hash << 5) - hash); return palette[Math.abs(hash) % palette.length]; }
function calc(result: OptimizationResult, placements: PlacementPreference[][], shelf: ShelfRecord, rules: FacingRule[]): OptimizationResult {
  let totalFacings = 0;
  const usedWidth = placements.map((level, index) => {
    let x = 0;
    for (const item of level) { item.level = index; item.x = x; x += item.product.width * item.facings; totalFacings += item.facings; }
    return x;
  });
  const feasible = result.unplaced.length === 0 && rules.every(rule => placements.flat().some(item => item.productId === rule.productId));
  const placedCount = placements.flat().length;
  return { ...result, placements, usedWidth, totalFacings, feasible, explanation: feasible ? `${placedCount} products fit across ${shelf.levelHeights.length} shelf levels. Physical placement is valid.` : `${result.unplaced.length} selected products still need fit adjustments.` };
}

export default function PlanogramEditor({ shelf, result, rules, onResultChange, onRulesChange }: Props) {
  const [dragged, setDragged] = useState<DragInfo | null>(null);
  const [hoverLevel, setHoverLevel] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [errorItem, setErrorItem] = useState("");
  const [view3d, setView3d] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState(result.placements.flat()[0]?.productId ?? "");
  const maxLevelHeight = Math.max(1, ...shelf.levelHeights);
  const usedWidth = result.placements.map((items, index) => items.reduce((sum, item) => sum + item.product.width * item.facings, 0));
  const totalShelfWidth = shelf.width * shelf.levelHeights.length;
  const totalUsed = usedWidth.reduce((sum, width) => sum + width, 0);
  const utilization = totalShelfWidth ? Math.round(totalUsed / totalShelfWidth * 100) : 0;
  const ordered = useMemo(() => result.placements.flatMap((items, level) => items.map((item, index) => ({ item, level, index }))), [result.placements]);
  const selectedPlacement = ordered.find(entry => entry.item.productId === selectedProductId) ?? ordered[0];
  function toast(text: string, productId = "") { setNotice(text); setErrorItem(productId); window.setTimeout(() => { setNotice(""); setErrorItem(""); }, 2600); }
  function update(placements: PlacementPreference[][], nextRules = rules) { onResultChange(calc(result, placements, shelf, nextRules)); }
  function ruleFor(id: string) { return rules.find(rule => rule.productId === id); }
  function currentUse(level: number, placements = result.placements) { return placements[level].reduce((sum, item) => sum + item.product.width * item.facings, 0); }
  function changeFacings(productId: string, delta: number) {
    const source = result.placements.findIndex(items => items.some(item => item.productId === productId)); if (source < 0) return;
    const item = result.placements[source].find(entry => entry.productId === productId)!;
    const rule = ruleFor(productId); const next = item.facings + delta;
    if (next < (rule?.min ?? 1) || next > (rule?.max ?? 50)) { toast(`Facing limit is ${rule?.min ?? 1}–${rule?.max ?? 50}.`, productId); return; }
    if (delta > 0 && currentUse(source) + item.product.width > shelf.width + 1e-8) { toast(`Only ${(shelf.width - currentUse(source)).toFixed(1)}″ remain on Level ${source + 1}.`, productId); return; }
    const levels = result.placements.map((entries, index) => index !== source ? [...entries] : entries.map(entry => entry.productId === productId ? { ...entry, facings: next } : { ...entry }));
    update(levels);
  }
  function remove(productId: string) {
    const levels = result.placements.map(entries => entries.filter(entry => entry.productId !== productId).map(entry => ({ ...entry })));
    const nextRules = rules.filter(rule => rule.productId !== productId);
    const removed = result.unplaced.filter(entry => entry.product.id !== productId);
    onRulesChange(nextRules); onResultChange(calc({ ...result, unplaced: removed }, levels, shelf, nextRules)); toast("Product removed from this layout.");
  }
  function validity(productId: string, targetLevel: number, fromLevel?: number): string {
    const item = result.placements.flat().find(entry => entry.productId === productId);
    if (!item) return "Product is no longer in this layout.";
    if (item.product.depth > shelf.depth) return `Product depth ${item.product.depth}″ exceeds shelf depth ${shelf.depth}″.`;
    if (item.product.height > shelf.levelHeights[targetLevel]) return `Product height ${item.product.height}″ exceeds Level ${targetLevel + 1} clear height ${shelf.levelHeights[targetLevel]}″.`;
    if (fromLevel !== targetLevel && currentUse(targetLevel) + item.product.width * item.facings > shelf.width + 1e-8) return `Level ${targetLevel + 1} does not have enough width for ${item.facings} facing${item.facings === 1 ? "" : "s"}.`;
    return "";
  }
  function moveLevel(productId: string, targetLevel: number) {
    const from = result.placements.findIndex(items => items.some(item => item.productId === productId));
    if (from < 0 || targetLevel === from) return;
    const issue = validity(productId, targetLevel, from); if (issue) { toast(issue, productId); return; }
    const levels = result.placements.map(items => [...items]);
    const itemIndex = levels[from].findIndex(item => item.productId === productId);
    const [item] = levels[from].splice(itemIndex, 1); levels[targetLevel].push({ ...item, level: targetLevel });
    update(levels);
  }
  function reorder(productId: string, direction: -1 | 1) {
    const level = result.placements.findIndex(items => items.some(item => item.productId === productId));
    if (level < 0) return;
    const entries = [...result.placements[level]]; const index = entries.findIndex(item => item.productId === productId); const other = index + direction;
    if (other < 0 || other >= entries.length) return;
    [entries[index], entries[other]] = [entries[other], entries[index]];
    const levels = result.placements.map((items, i) => i === level ? entries : [...items]); update(levels);
  }
  function startDrag(event: DragEvent<HTMLDivElement>, productId: string, fromLevel: number) {
    setDragged({ productId, fromLevel }); setErrorItem(""); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", productId);
  }
  function dragOver(event: DragEvent<HTMLDivElement>, level: number) {
    if (!dragged) return; event.preventDefault(); event.dataTransfer.dropEffect = "move"; setHoverLevel(level);
  }
  function drop(event: DragEvent<HTMLDivElement>, targetLevel: number, targetProductId?: string) {
    event.preventDefault(); event.stopPropagation(); const data = dragged; setHoverLevel(null); setDragged(null); if (!data) return;
    const issue = validity(data.productId, targetLevel, data.fromLevel);
    if (issue) { toast(issue, data.productId); return; }
    let levels = result.placements.map(items => [...items]);
    const fromIndex = levels[data.fromLevel].findIndex(item => item.productId === data.productId);
    if (fromIndex < 0) return;
    const [item] = levels[data.fromLevel].splice(fromIndex, 1);
    if (targetProductId && data.fromLevel === targetLevel) {
      const index = levels[targetLevel].findIndex(entry => entry.productId === targetProductId);
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const insertAt = index + (event.clientX > rect.left + rect.width / 2 ? 1 : 0);
      levels[targetLevel].splice(Math.min(insertAt, levels[targetLevel].length), 0, item);
    } else levels[targetLevel].push({ ...item, level: targetLevel });
    update(levels);
  }
  function dropClass(level: number) {
    if (hoverLevel !== level || !dragged) return "";
    return validity(dragged.productId, level, dragged.fromLevel) ? "drop-invalid" : "drop-valid";
  }

  return <section className="card live-editor"><div className="live-editor-header"><div><div className="eyebrow">STAGE 5 · INTERACTIVE EDITOR</div><h2>Adjust your shelf layout</h2><p>Select products in the 3D shelf to edit them, or switch to 2D to drag and reorder products directly.</p></div><span className="editor-live-badge"><i/>Live validation</span></div>
    <div className="editor-metrics"><span><strong>{result.totalFacings}</strong> total facings</span><i/><span><strong>{utilization}%</strong> shelf utilization</span><i/><span><strong>{Math.max(0, result.placements.flat().length)}</strong> products placed</span><i/><span><strong>{shelf.depth}″</strong> available depth</span></div>
    <div className="shelf-view-toggle" role="group" aria-label="Shelf display mode"><span>LAYOUT VIEW</span><button className={!view3d ? "active" : ""} onClick={() => setView3d(false)}><LayoutGrid size={12}/> 2D editor</button><button className={view3d ? "active" : ""} onClick={() => setView3d(true)}><Box size={12}/> 3D view</button></div>
    <div className={`live-shelf-area ${view3d ? "is-3d" : ""}`}>{view3d && <><Shelf3DView shelf={shelf} placements={result.placements} interactive selectedProductId={selectedPlacement?.item.productId} onSelectProduct={setSelectedProductId}/>{selectedPlacement && <div className="editor-3d-selection"><span className="editor-item-color" style={{ background: color(selectedPlacement.item.product) }}/><div className="editor-3d-selection-name"><small>SELECTED PRODUCT · LEVEL {selectedPlacement.level + 1}</small><strong>{selectedPlacement.item.product.name}</strong><span>{selectedPlacement.item.product.width} × {selectedPlacement.item.product.height} × {selectedPlacement.item.product.depth} in per unit · {selectedPlacement.item.product.depth > shelf.depth ? `Too deep for this ${shelf.depth}″ shelf` : "Fits shelf depth"}</span></div><div className="editor-3d-selection-controls"><button aria-label="Fewer facings" disabled={selectedPlacement.item.facings <= (ruleFor(selectedPlacement.item.productId)?.min ?? 1)} onClick={() => changeFacings(selectedPlacement.item.productId, -1)}><Minus size={13}/></button><strong>{selectedPlacement.item.facings}<small>facings</small></strong><button aria-label="More facings" disabled={selectedPlacement.item.facings >= (ruleFor(selectedPlacement.item.productId)?.max ?? 50)} onClick={() => changeFacings(selectedPlacement.item.productId, 1)}><Plus size={13}/></button><label><span className="sr-only">Move selected product to level</span><select value={selectedPlacement.level} onChange={event => moveLevel(selectedPlacement.item.productId, Number(event.target.value))}>{shelf.levelHeights.map((height, index) => <option key={index} value={index} disabled={selectedPlacement.item.product.height > height}>Level {index + 1}</option>)}</select></label><button aria-label="Move selected product left" disabled={selectedPlacement.index === 0} onClick={() => reorder(selectedPlacement.item.productId, -1)}><ArrowLeft size={13}/></button><button aria-label="Move selected product right" disabled={selectedPlacement.index === result.placements[selectedPlacement.level].length - 1} onClick={() => reorder(selectedPlacement.item.productId, 1)}><ArrowRight size={13}/></button><button className="editor-delete-item" aria-label="Remove selected product" onClick={() => remove(selectedPlacement.item.productId)}><Trash2 size={13}/></button></div></div>}</>}<div className="live-shelf-scale"><span>0″</span><i/><span>{shelf.width}″ shelf width</span><i/><span>{shelf.width}″</span></div><div className="live-shelf-rack">{shelf.levelHeights.map((levelHeight, level) => { const entries = result.placements[level] ?? []; const used = usedWidth[level] ?? 0; const height = Math.max(46, levelHeight / maxLevelHeight * 144); const isOver = used > shelf.width + 1e-8; return <div className={`live-level ${hoverLevel === level ? dropClass(level) : ""} ${isOver ? "level-invalid" : ""}`} key={level} onDragOver={event => dragOver(event, level)} onDragLeave={() => setHoverLevel(null)} onDrop={event => drop(event, level)}><div className="live-level-label"><strong>Level {level + 1}</strong><small>{levelHeight}″ clear</small></div><div className="live-level-track" style={{ height }}><div className="live-level-products">{entries.map(item => { const tooTall = item.product.height > levelHeight; const activeError = errorItem === item.productId; return <div key={item.productId} draggable onDragStart={event => startDrag(event, item.productId, level)} onDragEnd={() => { setDragged(null); setHoverLevel(null); }} onDragOver={event => { if (dragged?.fromLevel === level) { event.preventDefault(); setHoverLevel(level); } }} onDrop={event => drop(event, level, item.productId)} onClick={() => setSelectedProductId(item.productId)} className={`live-product-block ${tooTall || isOver || activeError ? "invalid" : ""} ${selectedPlacement?.item.productId === item.productId ? "selected" : ""} ${dragged?.productId === item.productId ? "being-dragged" : ""}`} style={{ width: `${item.product.width * item.facings / shelf.width * 100}%`, height: `${Math.max(5, item.product.height / levelHeight * 100)}%`, backgroundColor: `${color(item.product)}35`, borderColor: color(item.product) }} title={`${item.product.name} · ${item.product.width}″ × ${item.product.height}″ × ${item.product.depth}″ · ${item.facings} facing${item.facings === 1 ? "" : "s"}`}><span className="live-product-name">{item.product.name}</span><small>{item.facings} fac. <i>·</i> {item.product.sku}</small><GripVertical className="drag-grip" size={11}/></div>; })}<div className="live-empty-space" style={{ width: `${Math.max(0, 100 - used / shelf.width * 100)}%` }} onDrop={event => drop(event, level)}/></div><div className="live-level-board"/></div><div className="live-space-label"><strong>{Math.max(0, shelf.width - used).toFixed(1)}″</strong><small>remaining</small>{isOver && <AlertTriangle size={13}/>}</div></div>; })}</div><div className="editor-utilization-bar"><span>OVERALL UTILIZATION</span><div><i style={{ width: `${Math.min(100, utilization)}%` }} className={utilization > 100 ? "over" : ""}/></div><strong className={utilization > 100 ? "over" : ""}>{utilization}%</strong></div></div>
    {notice && <div className={`editor-notice ${errorItem ? "warning" : ""}`}><AlertTriangle size={13}/>{notice}</div>}
    {result.unplaced.length > 0 && <div className="editor-fit-warnings"><AlertTriangle size={13}/><div><strong>{result.unplaced.length} selected product{result.unplaced.length === 1 ? "" : "s"} need attention</strong>{result.unplaced.map(entry => <small key={entry.product.id}>{entry.product.name}: {entry.reason}</small>)}</div></div>}
    <div className="editor-item-list"><div className="editor-item-heading"><h3>Placement controls</h3><span>Use the dropdown or drag a block to move a product</span></div>{ordered.length ? ordered.map(({ item, level, index }) => { const rule = ruleFor(item.productId); const rowInvalid = errorItem === item.productId; return <div className={`editor-item-row ${rowInvalid ? "item-invalid" : ""}`} key={item.productId}><span className="editor-item-color" style={{ background: color(item.product) }}/><span className="editor-item-title"><strong>{item.product.name}</strong><small>{item.product.sku} · {item.product.width} × {item.product.height} × {item.product.depth} in</small></span><label className="editor-level-select"><span className="sr-only">Shelf level for {item.product.name}</span><select value={level} onChange={event => moveLevel(item.productId, Number(event.target.value))}>{shelf.levelHeights.map((height, i) => <option key={i} value={i} disabled={item.product.height > height}>Level {i + 1}</option>)}</select></label><div className="editor-facing-adjust"><button disabled={item.facings <= (rule?.min ?? 1)} onClick={() => changeFacings(item.productId, -1)} aria-label={`Remove a facing for ${item.product.name}`}><Minus size={12}/></button><strong>{item.facings}</strong><button disabled={item.facings >= (rule?.max ?? 50)} onClick={() => changeFacings(item.productId, 1)} aria-label={`Add a facing for ${item.product.name}`}><Plus size={12}/></button><small>facings</small></div><div className="editor-position-controls"><button disabled={index === 0} onClick={() => reorder(item.productId, -1)} aria-label={`Move ${item.product.name} left`} title="Move left"><ArrowLeft size={12}/></button><button disabled={index === result.placements[level].length - 1} onClick={() => reorder(item.productId, 1)} aria-label={`Move ${item.product.name} right`} title="Move right"><ArrowRight size={12}/></button></div><button className="editor-delete-item" onClick={() => remove(item.productId)} aria-label={`Remove ${item.product.name}`} title="Remove product"><Trash2 size={13}/></button></div>; }) : <div className="editor-no-items">No products are currently placed. Generate a new layout or add products in the builder.</div>}</div>
    <div className="live-editor-footer"><span><Check size={13}/> All changes update immediately in this layout.</span><span>Minimum and maximum facings: set in builder</span></div>
  </section>;
}

