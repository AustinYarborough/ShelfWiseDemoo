"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronRight, FileDown, FileText, Grid2X2, Minus, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { PLANOGRAM_STORAGE_KEY, PENDING_PLANOGRAM_KEY, readPlanograms, SavedPlanogram, writePlanograms } from "./planogram-storage";

const dateLabel = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }); };
const facingRule = (plan: SavedPlanogram, productId: string) => plan.rules.find(rule => rule.productId === productId);

type Props = { onOpen: () => void; shelfId?: string; shelfName?: string; embedded?: boolean; onClose?: () => void; onPlanogramsChange?: (plans: SavedPlanogram[]) => void };
export default function SavedPlanograms({ onOpen, shelfId, shelfName, embedded = false, onClose, onPlanogramsChange }: Props) {
  const [plans, setPlans] = useState<SavedPlanogram[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const [notice, setNotice] = useState("");
  const [printingId, setPrintingId] = useState("");
  const shelfPlans = useMemo(() => plans.filter(plan => !shelfId || plan.shelf.id === shelfId), [plans, shelfId]);
  const filtered = useMemo(() => shelfPlans.filter(plan => `${plan.name} ${plan.shelf.name} ${plan.rules.map(rule => rule.productId).join(" ")}`.toLowerCase().includes(query.toLowerCase().trim())), [shelfPlans, query]);
  const selected = shelfPlans.find(plan => plan.id === selectedId) ?? null;

  useEffect(() => { const loaded = readPlanograms().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); setPlans(loaded); setSelectedId((shelfId ? loaded.find(plan => plan.shelf.id === shelfId) : loaded[0])?.id ?? ""); onPlanogramsChange?.(loaded); }, [shelfId, onPlanogramsChange]);
  useEffect(() => { if (!printingId) return; const timer = window.setTimeout(() => window.print(), 250); const after = () => setPrintingId(""); window.addEventListener("afterprint", after); return () => { window.clearTimeout(timer); window.removeEventListener("afterprint", after); }; }, [printingId]);
  useEffect(() => { if (!notice) return; const id = window.setTimeout(() => setNotice(""), 3500); return () => window.clearTimeout(id); }, [notice]);

  function persist(next: SavedPlanogram[]) { setPlans(next); writePlanograms(next); onPlanogramsChange?.(next); }
  function editPlan(mutator: (plan: SavedPlanogram) => SavedPlanogram) {
    if (!selected) return;
    const updated = mutator({ ...selected, updatedAt: new Date().toISOString() });
    persist(plans.map(plan => plan.id === selected.id ? updated : plan));
  }
  function startRename(plan: SavedPlanogram) { setSelectedId(plan.id); setNewName(plan.name); setRenaming(true); }
  function saveRename() {
    if (!selected || !newName.trim()) return;
    editPlan(plan => ({ ...plan, name: newName.trim() })); setRenaming(false); setNotice("Planogram renamed.");
  }
  function removePlan() {
    if (!deleteId) return;
    const next = plans.filter(plan => plan.id !== deleteId); persist(next);
    if (selectedId === deleteId) setSelectedId((shelfId ? next.find(plan => plan.shelf.id === shelfId) : next[0])?.id ?? "");
    setDeleteId(""); setNotice("Planogram deleted.");
  }
  function openInBuilder(plan: SavedPlanogram) { localStorage.setItem(PENDING_PLANOGRAM_KEY, plan.id); onOpen(); }
  function changeFacings(levelIndex: number, productId: string, delta: number) {
    if (!selected) return;
    const current = selected.placements[levelIndex].find(item => item.product.id === productId);
    if (!current) return;
    const rule = facingRule(selected, productId); const nextFacing = current.facings + delta;
    if (nextFacing < (rule?.min ?? 1) || nextFacing > (rule?.max ?? 50)) { setNotice(`Allowed range: ${rule?.min ?? 1}–${rule?.max ?? 50} facings.`); return; }
    const levelUsed = selected.placements[levelIndex].reduce((sum, item) => sum + item.product.width * item.facings, 0);
    if (delta > 0 && levelUsed + current.product.width > selected.shelf.width + 1e-8) { setNotice(`This level has only ${(selected.shelf.width - levelUsed).toFixed(1)}″ of width remaining.`); return; }
    editPlan(plan => ({ ...plan, placements: plan.placements.map((items, index) => index !== levelIndex ? items : items.map(item => item.product.id === productId ? { ...item, facings: nextFacing } : item)) }));
  }
  function moveProduct(levelIndex: number, itemIndex: number, target: "left" | "right" | "up" | "down") {
    if (!selected) return;
    const levels = selected.placements.map(items => [...items]); const item = levels[levelIndex][itemIndex];
    if (target === "left" || target === "right") {
      const other = itemIndex + (target === "left" ? -1 : 1);
      if (other < 0 || other >= levels[levelIndex].length) return;
      [levels[levelIndex][itemIndex], levels[levelIndex][other]] = [levels[levelIndex][other], levels[levelIndex][itemIndex]];
    } else {
      const targetLevel = levelIndex + (target === "up" ? -1 : 1);
      if (targetLevel < 0 || targetLevel >= levels.length) return;
      if (item.product.height > selected.shelf.levelHeights[targetLevel]) { setNotice(`${item.product.name} is too tall for Level ${targetLevel + 1}.`); return; }
      const used = levels[targetLevel].reduce((sum, product) => sum + product.product.width * product.facings, 0);
      if (used + item.product.width * item.facings > selected.shelf.width + 1e-8) { setNotice(`Level ${targetLevel + 1} does not have enough width for ${item.product.name}.`); return; }
      levels[levelIndex].splice(itemIndex, 1); levels[targetLevel].push({ ...item, level: targetLevel });
    }
    editPlan(plan => ({ ...plan, placements: levels }));
  }
  function removeProduct(levelIndex: number, productId: string) {
    editPlan(plan => ({ ...plan, placements: plan.placements.map((items, index) => index === levelIndex ? items.filter(item => item.product.id !== productId) : items), rules: plan.rules.filter(rule => rule.productId !== productId) }));
    setNotice("Product removed from this planogram.");
  }
  function levelWidth(plan: SavedPlanogram, levelIndex: number) { return plan.placements[levelIndex].reduce((sum, item) => sum + item.product.width * item.facings, 0); }
  const printPlan = plans.find(plan => plan.id === printingId) ?? null;

  return <div className={`content saved-plans-content ${embedded ? "embedded" : ""}`}>
    <div className="page-heading saved-plans-heading"><div><div className="eyebrow">{embedded ? "STORE PLANOGRAMS" : "MERCHANDISING"}</div><h1>{embedded ? `${shelfName ?? selected?.shelf.name ?? "Shelf"} planograms` : "Saved planograms"}</h1><p>{embedded ? "Layouts saved for this fixture at its selected location and aisle." : "Review, adjust, and export your shelf layouts."}</p></div><div className="saved-heading-actions"><button className="primary-button" onClick={onOpen}><Plus size={15}/> Create planogram</button>{embedded && onClose && <button className="icon-button" onClick={onClose} aria-label="Close planograms" title="Close"><X size={16}/></button>}</div></div>
    <div className="saved-stats"><div className="card saved-stat"><span><Grid2X2 size={15}/></span><div><small>Saved layouts</small><strong>{shelfPlans.length}</strong></div></div><div className="card saved-stat"><span><FileText size={15}/></span><div><small>Products placed</small><strong>{shelfPlans.reduce((sum, plan) => sum + plan.placements.flat().length, 0)}</strong></div></div><div className="card saved-stat"><span><Check size={15}/></span><div><small>Last updated</small><strong>{shelfPlans.length ? dateLabel([...shelfPlans].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))[0].updatedAt).split(",").slice(0, 2).join(",") : "—"}</strong></div></div></div>
    <section className="saved-plan-workspace"><div className="card saved-plan-list"><div className="saved-list-header"><div><h2>{embedded ? "This shelf’s layouts" : "Your planograms"}</h2><p>{filtered.length} {filtered.length === 1 ? "layout" : "layouts"}</p></div><div className="saved-search"><Search size={14}/><input placeholder="Search layouts..." value={query} onChange={e => setQuery(e.target.value)}/></div></div>{filtered.length ? <div className="saved-plan-items">{filtered.map(plan => <button className={`saved-plan-item ${selectedId === plan.id ? "active" : ""}`} key={plan.id} onClick={() => { setSelectedId(plan.id); setRenaming(false); }}><span className="saved-plan-icon"><Grid2X2 size={15}/></span><span className="saved-plan-item-copy"><strong>{plan.name}</strong><small>{plan.shelf.name} <i>·</i> {plan.placements.flat().length} products</small><small>Updated {dateLabel(plan.updatedAt)}</small></span><ChevronRight size={15}/></button>)}</div> : <div className="saved-empty"><span><Grid2X2 size={20}/></span><strong>{shelfPlans.length ? "No matching planograms" : "No layouts for this shelf yet"}</strong><p>{shelfPlans.length ? "Try another name or shelf." : "Build a planogram for this door, then save it to keep the layout with this store setup."}</p>{!shelfPlans.length && <button className="primary-button" onClick={onOpen}><Plus size={14}/> Build a planogram</button>}</div>}</div>
      {selected ? <div className="card saved-plan-detail"><div className="saved-detail-header"><div className="saved-detail-title">{renaming ? <div className="rename-plan"><input autoFocus value={newName} maxLength={80} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") setRenaming(false); }}/><button className="icon-button" onClick={saveRename} aria-label="Save name"><Check size={15}/></button><button className="icon-button" onClick={() => setRenaming(false)} aria-label="Cancel rename"><X size={15}/></button></div> : <><h2>{selected.name}</h2><button className="icon-button" aria-label="Rename planogram" title="Rename" onClick={() => startRename(selected)}><Pencil size={14}/></button></>}<span className="saved-status"><i/>Saved</span></div><p>{selected.shelf.locationName ?? "Store"} <i>·</i> {selected.shelf.aisleName ?? "Aisle"} aisle <i>·</i> {selected.shelf.name} <i>·</i> {selected.shelf.width} × {selected.shelf.height} × {selected.shelf.depth} in</p><div className="saved-detail-actions"><button className="secondary-button" onClick={() => setPrintingId(selected.id)}><FileDown size={14}/> Export PDF</button><button className="primary-button" onClick={() => openInBuilder(selected)}><Pencil size={13}/> Reopen in builder</button><button className="icon-button saved-delete" aria-label="Delete planogram" title="Delete" onClick={() => setDeleteId(selected.id)}><Trash2 size={15}/></button></div></div>
        <div className="saved-layout-editor"><div className="saved-editor-heading"><div><h3>Layout editor</h3><p>Adjust facings, reorder products, or move them between shelf levels. Changes save automatically.</p></div><span>EDITING</span></div>{selected.placements.map((items, levelIndex) => <div className="saved-editor-level" key={levelIndex}><div className="saved-editor-level-head"><strong>Level {levelIndex + 1}</strong><span>{selected.shelf.levelHeights[levelIndex]}″ clear height</span><small>{levelWidth(selected, levelIndex).toFixed(1)}″ / {selected.shelf.width}″ used</small></div><div className="saved-editor-products">{items.map((item, itemIndex) => { const rule = facingRule(selected, item.product.id); const widthPercent = item.product.width * item.facings / selected.shelf.width * 100; return <div className="saved-editor-product" key={item.product.id}><span className="saved-editor-swatch" style={{ background: item.product.image ? `url(${item.product.image}) center / cover` : undefined }}>{!item.product.image && item.product.brand.slice(0, 1)}</span><span className="saved-editor-product-name"><strong>{item.product.name}</strong><small>{item.product.sku} <i>·</i> {item.product.width} × {item.product.height} × {item.product.depth} in</small></span><span className="editor-width-bar"><i style={{ width: `${widthPercent}%` }}/><small>{(item.product.width * item.facings).toFixed(1)}″</small></span><div className="editor-facing-control"><button aria-label={`Fewer facings for ${item.product.name}`} disabled={item.facings <= (rule?.min ?? 1)} onClick={() => changeFacings(levelIndex, item.product.id, -1)}><Minus size={12}/></button><strong>{item.facings}</strong><button aria-label={`More facings for ${item.product.name}`} disabled={item.facings >= (rule?.max ?? 50)} onClick={() => changeFacings(levelIndex, item.product.id, 1)}><Plus size={12}/></button></div><div className="editor-move-controls"><button aria-label={`Move ${item.product.name} left`} disabled={itemIndex === 0} onClick={() => moveProduct(levelIndex, itemIndex, "left")}><ArrowLeft size={12}/></button><button aria-label={`Move ${item.product.name} right`} disabled={itemIndex === items.length - 1} onClick={() => moveProduct(levelIndex, itemIndex, "right")}><ArrowRight size={12}/></button><button aria-label={`Move ${item.product.name} up a level`} disabled={levelIndex === 0} onClick={() => moveProduct(levelIndex, itemIndex, "up")}><ArrowUp size={12}/></button><button aria-label={`Move ${item.product.name} down a level`} disabled={levelIndex === selected.placements.length - 1} onClick={() => moveProduct(levelIndex, itemIndex, "down")}><ArrowDown size={12}/></button></div><button className="editor-remove" aria-label={`Remove ${item.product.name}`} title="Remove product" onClick={() => removeProduct(levelIndex, item.product.id)}><X size={13}/></button></div>; })}{items.length === 0 && <div className="empty-level">No products on this level.</div>}</div></div>)}<div className="saved-editor-footer"><Check size={13}/> Every edit is saved automatically and checked against shelf capacity.</div></div>
      </div> : <div className="card saved-plan-detail saved-no-selection"><span><Grid2X2 size={20}/></span><h2>Select a planogram</h2><p>Choose a saved layout to review, edit, or export its stocking guide.</p></div>}
    </section>
    <div className="saved-page-note"><FileDown size={13}/> PDF export opens the print dialog; choose <b>Save as PDF</b> to download the stocking guide.</div>
    {notice && <div className="catalog-message"><span className="toast-check"><Check size={12}/></span>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={14}/></button></div>}
    {deleteId && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setDeleteId(""); }}><div className="confirm-modal"><div className="delete-icon"><Trash2 size={19}/></div><h2>Delete planogram?</h2><p><strong>{plans.find(plan => plan.id === deleteId)?.name}</strong> will be permanently removed from this browser.</p><div className="confirm-actions"><button className="secondary-button" onClick={() => setDeleteId("")}>Cancel</button><button className="danger-button" onClick={removePlan}><Trash2 size={14}/> Delete planogram</button></div></div></div>}
    {printPlan && <PrintableGuide plan={printPlan}/>}
  </div>;
}

function PrintableGuide({ plan }: { plan: SavedPlanogram }) {
  return <div className="planogram-print-guide"><header><div className="print-brand">SHELFWISE <span>STOCKING GUIDE</span></div><small>Generated {dateLabel(plan.updatedAt)}</small></header><h1>{plan.name}</h1><p className="print-shelf-detail">{plan.shelf.locationName ?? "Store"} · {plan.shelf.aisleName ?? "Aisle"} aisle · {plan.shelf.name} · {plan.shelf.width}″ W × {plan.shelf.height}″ H × {plan.shelf.depth}″ D · {plan.shelf.levelHeights.length} levels</p><section className="print-visual"><h2>Shelf layout</h2>{plan.shelf.levelHeights.map((height, index) => <div className="print-level" key={index}><div className="print-level-name">LEVEL {index + 1}<small>{height}″ clear</small></div><div className="print-level-track">{plan.placements[index]?.map(item => <div className="print-block" key={item.product.id} style={{ width: `${item.product.width * item.facings / plan.shelf.width * 100}%`, backgroundColor: "#e8ebf2" }}><strong>{item.product.name}</strong><small>{item.facings} facings</small></div>)}</div></div>)}</section><section className="print-product-list"><h2>Stocking positions</h2><table><thead><tr><th>LEVEL</th><th>POSITION FROM LEFT</th><th>PRODUCT</th><th>SKU</th><th>FACINGS</th><th>ITEM SIZE (W × H × D)</th></tr></thead><tbody>{plan.placements.flatMap((items, level) => { let x = 0; return items.map(item => { const position = x; x += item.product.width * item.facings; return <tr key={`${level}-${item.product.id}`}><td>{level + 1}</td><td>{position.toFixed(1)}″</td><td>{item.product.name}</td><td>{item.product.sku}</td><td>{item.facings}</td><td>{item.product.width} × {item.product.height} × {item.product.depth}″</td></tr>; }); })}</tbody></table></section><footer>Use product positions from the left edge of each shelf level. Measurements are in inches.</footer></div>;
}
