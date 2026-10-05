"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Check, ChevronDown, Circle, Grid2X2, Info, Layers3, Package, Plus, RotateCcw, Search, Sparkles, Store, X } from "lucide-react";
import { Product, productCatalogSeed } from "./product-catalog";
import { AisleRecord, ShelfRecord, shelfConfigurationSeed, storeLocationSeed, aisleSeed, StoreLocation } from "./shelf-configuration";
import { FacingRule, OptimizationResult, optimizePlanogram, parseMerchandisingInstruction } from "./planogram-optimizer";
import { PENDING_PLANOGRAM_KEY, PENDING_SHELF_KEY, readPlanograms, savePlanogram } from "./planogram-storage";
import PlanogramEditor from "./planogram-editor";

const productStorage = "shelfwise.products.v1";
const shelfStorage = "shelfwise.shelves.v1";
const locationStorage = "shelfwise.locations.v1";
const aisleStorage = "shelfwise.aisles.v1";
const colors = ["#e3b65f", "#df8876", "#84b39b", "#829ed1", "#b398cd", "#d58f9f", "#76aeb5", "#c5a779"];
const inch = (number: number) => Number.isInteger(number) ? String(number) : number.toFixed(1).replace(/\.0$/, "");

function productColor(product: Product) {
  let hash = 0; for (const char of product.sku) hash = char.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

type QuickDoorDraft = { name: string; width: number; height: number; depth: number; levelHeights: number[] };
export default function PlanogramBuilder({ onManageStore }: { onManageStore: () => void }) {
  const [products, setProducts] = useState<Product[]>(productCatalogSeed);
  const [shelves, setShelves] = useState<ShelfRecord[]>(shelfConfigurationSeed);
  const [locations, setLocations] = useState<StoreLocation[]>(storeLocationSeed);
  const [aisles, setAisles] = useState<AisleRecord[]>(aisleSeed);
  const [locationId, setLocationId] = useState(storeLocationSeed[0]?.id ?? "");
  const [aisleId, setAisleId] = useState(aisleSeed[0]?.id ?? "");
  const [shelfId, setShelfId] = useState(shelfConfigurationSeed[0]?.id ?? "");
  const [rules, setRules] = useState<Record<string, FacingRule>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [instruction, setInstruction] = useState("");
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedId, setSavedId] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [showQuickDoor, setShowQuickDoor] = useState(false);
  const [quickDoor, setQuickDoor] = useState<QuickDoorDraft>({ name: "", width: 36, height: 78, depth: 24, levelHeights: [15, 15, 15, 15] });
  const [quickError, setQuickError] = useState("");
  const hydrationStarted = useRef(false);

  useEffect(() => {
    if (hydrationStarted.current) return;
    hydrationStarted.current = true;
    try {
      const savedProducts = localStorage.getItem(productStorage);
      if (savedProducts) { const parsed: unknown = JSON.parse(savedProducts); if (Array.isArray(parsed)) setProducts(parsed as Product[]); }
      const savedShelves = localStorage.getItem(shelfStorage);
      const savedLocations = localStorage.getItem(locationStorage);
      const savedAisles = localStorage.getItem(aisleStorage);
      const parsedLocations: unknown = savedLocations ? JSON.parse(savedLocations) : null;
      const parsedAisles: unknown = savedAisles ? JSON.parse(savedAisles) : null;
      let nextLocations: StoreLocation[] = Array.isArray(parsedLocations) ? parsedLocations as StoreLocation[] : storeLocationSeed;
      let nextAisles: AisleRecord[] = Array.isArray(parsedAisles) ? parsedAisles as AisleRecord[] : aisleSeed;
      let nextShelves = shelfConfigurationSeed;
      if (savedShelves) {
        const parsed: unknown = JSON.parse(savedShelves);
        if (Array.isArray(parsed)) {
          const hasHierarchy = Boolean(savedLocations && savedAisles);
          if (parsed.length && !hasHierarchy) {
            const loc = nextLocations[0] ?? storeLocationSeed[0];
            const legacyAisle = { id: "aisle-existing-migration", locationId: loc.id, name: "Existing shelves", category: "" };
            nextAisles = [...nextAisles, legacyAisle];
            nextShelves = [...shelfConfigurationSeed, ...(parsed as ShelfRecord[]).map(item => ({ ...item, locationId: loc.id, locationName: loc.name, aisleId: legacyAisle.id, aisleName: legacyAisle.name }))];
          } else if (hasHierarchy) nextShelves = parsed as ShelfRecord[];
          else nextShelves = parsed as ShelfRecord[];
        }
      }
      setLocations(nextLocations); setAisles(nextAisles); setShelves(nextShelves);
      setLocationId(nextLocations[0]?.id ?? "");
      const firstAisle = nextAisles.find(item => item.locationId === nextLocations[0]?.id);
      setAisleId(firstAisle?.id ?? "");
      setShelfId(nextShelves.find(item => item.locationId === nextLocations[0]?.id && item.aisleId === firstAisle?.id)?.id ?? "");
      if (savedShelves) {
        localStorage.setItem(locationStorage, JSON.stringify(nextLocations));
        localStorage.setItem(aisleStorage, JSON.stringify(nextAisles));
        localStorage.setItem(shelfStorage, JSON.stringify(nextShelves));
      }
      const pendingShelfId = localStorage.getItem(PENDING_SHELF_KEY);
      if (pendingShelfId) {
        localStorage.removeItem(PENDING_SHELF_KEY);
        const targetShelf = nextShelves.find(item => item.id === pendingShelfId);
        if (targetShelf) {
          setShelfId(targetShelf.id);
          if (targetShelf.locationId) setLocationId(targetShelf.locationId);
          if (targetShelf.aisleId) setAisleId(targetShelf.aisleId);
        }
      }
      const pendingId = localStorage.getItem(PENDING_PLANOGRAM_KEY);
      if (pendingId) {
        localStorage.removeItem(PENDING_PLANOGRAM_KEY);
        const plan = readPlanograms().find(item => item.id === pendingId);
        if (plan) {
          setSavedId(plan.id); setSaveName(plan.name); setShelfId(plan.shelf.id);
          const planLocation: StoreLocation = { id: plan.shelf.locationId ?? "saved-location", name: plan.shelf.locationName ?? "Saved store", address: "" };
          const planAisle: AisleRecord = { id: plan.shelf.aisleId ?? "saved-aisle", locationId: planLocation.id, name: plan.shelf.aisleName ?? "Saved aisle", category: "" };
          setLocations(current => current.some(item => item.id === planLocation.id) ? current : [...current, planLocation]);
          setAisles(current => current.some(item => item.id === planAisle.id) ? current : [...current, planAisle]);
          setLocationId(planLocation.id); setAisleId(planAisle.id);
          setShelves(current => current.some(item => item.id === plan.shelf.id) ? current : [...current, plan.shelf]);
          const snapshotProducts = plan.placements.flat().map(item => item.product);
          setProducts(current => [...snapshotProducts.filter(product => !current.some(item => item.id === product.id)), ...current]);
          setRules(Object.fromEntries(plan.rules.map(rule => [rule.productId, rule])));
          setInstruction(plan.instruction);
          const usedWidth = plan.placements.map(level => level.reduce((sum, item) => sum + item.product.width * item.facings, 0));
          setResult({ feasible: true, placements: plan.placements, unplaced: [], totalFacings: plan.placements.flat().reduce((sum, item) => sum + item.facings, 0), usedWidth, explanation: `Reopened “${plan.name}”. Adjust product rules and regenerate, or save a revised version.` });
        }
      }
    } catch { /* The sample data stays available if local data is unreadable. */ }
    setHydrated(true);
  }, []);
  const location = locations.find(item => item.id === locationId);
  const availableAisles = aisles.filter(item => item.locationId === locationId);
  const aisle = availableAisles.find(item => item.id === aisleId) ?? availableAisles[0];
  const availableShelves = shelves.filter(item => item.locationId === locationId && item.aisleId === aisle?.id);
  const shelf = availableShelves.find(item => item.id === shelfId) ?? availableShelves[0];
  const selectedRules = useMemo(() => Object.values(rules), [rules]);
  const selectedIds = useMemo(() => new Set(selectedRules.map(rule => rule.productId)), [selectedRules]);
  const categoryOptions = useMemo(() => [...new Set(products.map(product => product.category))].sort(), [products]);
  const filteredProducts = useMemo(() => products.filter(product => (category === "All categories" || product.category === category) && `${product.name} ${product.sku} ${product.brand} ${product.category}`.toLowerCase().includes(query.toLowerCase().trim())), [products, category, query]);
  const parsedPreferences = useMemo(() => parseMerchandisingInstruction(instruction, products.filter(product => selectedIds.has(product.id))), [instruction, products, selectedIds]);

  function toggleProduct(product: Product) {
    setRules(current => {
      const next = { ...current };
      if (next[product.id]) delete next[product.id];
      else next[product.id] = { productId: product.id, min: 1, max: Math.max(1, Math.min(8, Math.floor((shelf?.width ?? 48) / product.width))), priority: "standard" };
      return next;
    });
    setResult(null); setError("");
  }
  function updateRule(id: string, update: Partial<FacingRule>) {
    setRules(current => ({ ...current, [id]: { ...current[id], ...update } })); setResult(null);
  }
  function generate() {
    if (!shelf) { setError("Create a shelf configuration before generating a layout."); return; }
    if (!selectedRules.length) { setError("Select at least one product to build a planogram."); return; }
    const invalid = selectedRules.find(rule => rule.min < 1 || rule.max < rule.min || rule.max > 50);
    if (invalid) { setError("Each product needs valid facing limits: minimum at least 1, maximum at least minimum and no more than 50."); return; }
    const preferences = parseMerchandisingInstruction(instruction, products.filter(product => selectedIds.has(product.id)));
    const computed = optimizePlanogram(shelf, products.filter(product => selectedIds.has(product.id)), selectedRules, preferences);
    setResult(computed); setError("");
  }
  function changeShelf(id: string) { setShelfId(id); setResult(null); setError(""); }
  function changeLocation(id: string) {
    const nextAisle = aisles.find(item => item.locationId === id);
    setLocationId(id); setAisleId(nextAisle?.id ?? "");
    setShelfId(shelves.find(item => item.locationId === id && item.aisleId === nextAisle?.id)?.id ?? ""); setResult(null); setError("");
  }
  function changeAisle(id: string) {
    setAisleId(id); setShelfId(shelves.find(item => item.locationId === locationId && item.aisleId === id)?.id ?? ""); setResult(null); setError("");
  }
  function openQuickDoor() {
    setQuickDoor({ name: `Door ${availableShelves.length + 1}`, width: 36, height: 78, depth: 24, levelHeights: [15, 15, 15, 15] });
    setQuickError(""); setShowQuickDoor(true);
  }
  function setQuickLevelCount(count: number) {
    const safe = Math.min(12, Math.max(1, count));
    setQuickDoor(current => { const levelHeights = [...current.levelHeights]; if (safe > levelHeights.length) { const each = Math.max(1, Math.floor(current.height / safe)); while (levelHeights.length < safe) levelHeights.push(each); } else levelHeights.length = safe; return { ...current, levelHeights }; });
  }
  function saveQuickDoor() {
    if (!location || !aisle) { setQuickError("Select a location and aisle before adding a shelf or door."); return; }
    if (!quickDoor.name.trim()) { setQuickError("Enter a name for this shelf or door."); return; }
    for (const [label, value] of [["Width", quickDoor.width], ["Height", quickDoor.height], ["Depth", quickDoor.depth]] as const) if (!Number.isFinite(value) || value <= 0 || value > 1000) { setQuickError(`${label} must be greater than 0 and at most 1,000 inches.`); return; }
    if (quickDoor.levelHeights.some(height => !Number.isFinite(height) || height <= 0) || quickDoor.levelHeights.reduce((sum, height) => sum + height, 0) > quickDoor.height) { setQuickError("Level clear heights must be positive and add up to no more than the overall shelf height."); return; }
    if (availableShelves.some(item => item.name.toLowerCase() === quickDoor.name.trim().toLowerCase())) { setQuickError("A shelf or door with this name already exists in this aisle."); return; }
    const created: ShelfRecord = { ...quickDoor, id: crypto.randomUUID(), name: quickDoor.name.trim(), locationId: location.id, locationName: location.name, aisleId: aisle.id, aisleName: aisle.name, updatedAt: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) };
    const next = [...shelves, created]; setShelves(next); localStorage.setItem(shelfStorage, JSON.stringify(next)); setShelfId(created.id); setResult(null); setError(""); setShowQuickDoor(false);
  }
  function resetSelection() { setRules({}); setResult(null); setError(""); }
  function saveCurrentPlan() {
    if (!shelf || !result) return;
    if (!result.feasible) { setSaveMessage("Resolve fit warnings before saving this layout."); return; }
    const now = new Date().toISOString();
    const existing = readPlanograms().find(item => item.id === savedId);
    const placedIds = new Set(result.placements.flat().map(item => item.productId));
    const plan = { id: savedId || crypto.randomUUID(), name: saveName.trim(), shelf: { ...shelf, levelHeights: [...shelf.levelHeights] }, rules: selectedRules.filter(rule => placedIds.has(rule.productId)), placements: result.placements.map(level => level.map(item => ({ ...item, product: { ...item.product } }))), instruction, createdAt: existing?.createdAt ?? now, updatedAt: now };
    savePlanogram(plan); setSavedId(plan.id); setSaveName(plan.name); setShowSave(false); setSaveMessage("Planogram saved with this door in Store setup.");
    window.setTimeout(() => setSaveMessage(""), 3500);
  }

  return <div className="content builder-content">
    <div className="page-heading builder-heading"><div><div className="eyebrow">PLANOGRAM WORKFLOW · LOCATION → AISLE → DOOR</div><h1>Planogram builder</h1><p>Choose where the layout goes, then merchandise its shelf or cooler door.</p></div><span className="local-engine-badge"><span/> Local optimization engine</span></div>
    <div className="builder-steps"><span className={location ? "complete" : "current"}><i>{location ? <Check size={11}/> : "1"}</i>Location & aisle</span><span className={`step-line ${shelf ? "active" : ""}`}/><span className={shelf ? "complete" : "current"}><i>{shelf ? <Check size={11}/> : "2"}</i>Choose door</span><span className={`step-line ${selectedRules.length ? "active" : ""}`}/><span className={selectedRules.length ? "complete" : ""}><i>{selectedRules.length ? <Check size={11}/> : "3"}</i>Products</span><span className={`step-line ${result ? "active" : ""}`}/><span className={result ? "complete" : ""}><i>{result ? <Check size={11}/> : "4"}</i>Optimize & edit</span></div>
    <section className="builder-config-grid">
      <div className="card builder-products-panel"><div className="builder-panel-header"><div className="builder-panel-title"><span className="builder-step-icon"><Package size={16}/></span><div><h2>Products</h2><p>Select products to include in this layout</p></div></div><span className="selected-count">{selectedRules.length} selected</span></div>
        <div className="builder-product-toolbar"><div className="catalog-search"><Search size={15}/><input aria-label="Search catalog products" placeholder="Search products..." value={query} onChange={e => setQuery(e.target.value)}/>{query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={13}/></button>}</div><label className="category-select-label"><span className="sr-only">Filter products by category</span><select value={category} onChange={e => setCategory(e.target.value)}><option>All categories</option>{categoryOptions.map(item => <option key={item}>{item}</option>)}</select><ChevronDown size={13}/></label></div>
        {products.length ? <div className="builder-product-list">{filteredProducts.map(product => { const checked = selectedIds.has(product.id); return <div className={`builder-product-row ${checked ? "selected" : ""}`} key={product.id}><label className="builder-check-label"><input type="checkbox" checked={checked} onChange={() => toggleProduct(product)}/><span className="custom-check">{checked && <Check size={11}/>}</span><span className="product-image product-image-placeholder" style={{ background: `${productColor(product)}2b`, color: "#6b7180" }}>{product.brand.slice(0, 1).toUpperCase()}</span><span className="builder-product-copy"><strong>{product.name}</strong><small>{product.brand} <i>·</i> {product.sku}</small></span></label><span className="product-dimensions">{product.width} × {product.height} × {product.depth}<small>in</small></span></div>; })}{filteredProducts.length === 0 && <div className="builder-no-products">No products match these filters.</div>}</div> : <div className="builder-no-products"><p>Your catalog is empty. Add products in Product catalog first.</p></div>}
        <div className="builder-product-footer"><button className="builder-reset" onClick={resetSelection} disabled={!selectedRules.length}><RotateCcw size={12}/> Clear selection</button><span><Info size={12}/> Dimensions shown as W × H × D</span></div>
      </div>
      <div className="builder-options-column">
        <div className="card builder-shelf-panel"><div className="builder-panel-header"><div className="builder-panel-title"><span className="builder-step-icon"><Store size={16}/></span><div><h2>Where will this planogram go?</h2><p>Choose a store location, aisle, and individual shelf / door</p></div></div></div>
          {locations.length ? <><div className="builder-store-selects"><label className="builder-hierarchy-field"><span>STORE LOCATION</span><select value={locationId} onChange={e => changeLocation(e.target.value)}>{locations.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select><ChevronDown size={12}/></label><label className="builder-hierarchy-field"><span>AISLE</span><select value={aisle?.id ?? ""} onChange={e => changeAisle(e.target.value)} disabled={!availableAisles.length}><option value="">Select an aisle</option>{availableAisles.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select><ChevronDown size={12}/></label>{aisle && availableShelves.length > 0 && <label className="builder-hierarchy-field"><span>SHELF / DOOR</span><select value={shelf?.id ?? ""} onChange={e => changeShelf(e.target.value)}>{availableShelves.map(item => <option value={item.id} key={item.id}>{item.name} · {item.width}″ × {item.height}″</option>)}</select><ChevronDown size={12}/></label>}</div>
            {shelf && <div className="selected-shelf-summary"><div className="mini-shelf-icon"><Store size={17}/></div><div className="selected-shelf-dimensions"><strong>{shelf.name}<small> · {shelf.aisleName ?? aisle?.name} aisle</small></strong><span>{shelf.locationName ?? location?.name} <i>·</i> {shelf.width} × {shelf.height} × {shelf.depth} in <i>·</i> {shelf.levelHeights.length} levels</span></div><button className="quick-door-link" onClick={openQuickDoor}><Plus size={12}/> Add another door</button></div>}
            {location && !aisle && <div className="builder-inline-empty"><span>No aisle at this location yet.</span><button onClick={onManageStore}>Create an aisle in Store setup <ArrowRight size={12}/></button></div>}
            {aisle && availableShelves.length === 0 && <div className="builder-inline-empty"><span>No doors configured in {aisle.name} yet.</span><button onClick={openQuickDoor}><Plus size={12}/> Add the first shelf / door</button></div>}
            {!locations.length && <div className="builder-inline-empty"><span>Set up a store location and aisle to begin.</span><button onClick={onManageStore}>Open Store setup <ArrowRight size={12}/></button></div>}
          </> : <div className="builder-empty-shelf"><p>No store locations are configured yet.</p><button onClick={onManageStore}>Create a location and aisle in Store setup <ArrowRight size={12}/></button></div>}
        </div>
        <div className="card builder-rules-panel"><div className="builder-panel-header"><div className="builder-panel-title"><span className="builder-step-icon"><Layers3 size={16}/></span><div><h2>Facing limits & priority</h2><p>Set a minimum, maximum, and placement weight</p></div></div></div>
          {selectedRules.length ? <div className="facing-rule-list">{selectedRules.map(rule => { const product = products.find(p => p.id === rule.productId); if (!product) return null; return <div className="facing-rule" key={rule.productId}><div className="facing-rule-product"><span className="rule-color" style={{ background: productColor(product) }}/><span><strong>{product.name}</strong><small>{product.sku}</small></span></div><label className="facing-field"><span>MIN</span><input aria-label={`Minimum facings for ${product.name}`} type="number" min="1" max="50" value={rule.min} onChange={e => updateRule(product.id, { min: Number(e.target.value) })}/></label><label className="facing-field"><span>MAX</span><input aria-label={`Maximum facings for ${product.name}`} type="number" min="1" max="50" value={rule.max} onChange={e => updateRule(product.id, { max: Number(e.target.value) })}/></label><label className="priority-field"><span className="sr-only">Placement priority for {product.name}</span><select value={rule.priority} onChange={e => updateRule(product.id, { priority: e.target.value as FacingRule["priority"] })}><option value="low">Low</option><option value="standard">Standard</option><option value="high">High</option></select><ChevronDown size={11}/></label><button className="remove-rule" aria-label={`Remove ${product.name}`} onClick={() => toggleProduct(product)}><X size={14}/></button></div>; })}</div> : <div className="rules-empty"><span><Circle size={16}/></span><p>Select products to set their facing requirements and priority.</p></div>}
          <div className="instruction-field"><div className="instruction-label"><span><Sparkles size={13}/> Merchandising instructions</span><small>Optional</small></div><textarea value={instruction} onChange={e => { setInstruction(e.target.value); setResult(null); }} placeholder="e.g. Prioritize top sellers. Give snacks more facings at eye level." rows={3}/><div className="instruction-helper">Local rules translate product, category, velocity, and shelf-level phrases into placement preferences.</div>{parsedPreferences.recognized.length > 0 && <div className="recognized-preferences"><span>Recognized</span>{parsedPreferences.recognized.map(note => <div key={note}><Check size={11}/>{note}</div>)}</div>}</div>
        </div>
        <button className="generate-button" onClick={generate}><Sparkles size={16}/> Generate optimized layout <ArrowRight size={15}/></button>
        {error && <div className="builder-error"><AlertTriangle size={14}/>{error}</div>}
      </div>
    </section>
    {result ? <section className="card generated-result"><div className="generated-header"><div><div className="eyebrow">OPTIMIZATION RESULT</div><h2>{result.feasible ? "Your layout is ready" : "Layout generated with fit warnings"}</h2><p>{result.explanation}</p></div><span className={`result-status ${result.feasible ? "success" : "warning"}`}>{result.feasible ? <Check size={12}/> : <AlertTriangle size={12}/>} {result.feasible ? "All selected products fit" : `${result.unplaced.length} need attention`}</span></div>
      {shelf && <PlanogramEditor shelf={shelf} result={result} rules={selectedRules} onResultChange={setResult} onRulesChange={next => setRules(Object.fromEntries(next.map(rule => [rule.productId, rule])))}/>}
      {result.unplaced.length > 0 && <div className="unplaced-list"><div className="unplaced-title"><AlertTriangle size={14}/> Products that need adjustments</div>{result.unplaced.map(item => <div className="unplaced-item" key={item.product.id}><div><strong>{item.product.name}</strong><small>{item.product.sku}</small></div><p>{item.reason}</p></div>)}</div>}
      <div className="generated-save-row"><span>{saveMessage && <span className="save-inline-message"><Check size={12}/>{saveMessage}</span>}</span><button className="primary-button" disabled={!result.feasible} onClick={() => { setSaveMessage(""); setSaveName(current => current || `${shelf?.name ?? "Shelf"} planogram`); setShowSave(true); }}><Check size={14}/>{savedId ? "Save changes" : "Save planogram"}</button></div>
      {!result.feasible && <div className="save-warning"><AlertTriangle size={13}/> Resolve the fit warnings above before saving or exporting this layout.</div>}
    </section> : <section className="builder-help"><div><span className="help-icon"><Grid2X2 size={17}/></span><div><strong>How the local optimizer works</strong><p>It checks product width, height, and depth against your selected shelf, meets each minimum facing target where possible, then assigns remaining space by sales velocity and priority.</p></div></div><span className="help-tag">Deterministic · No AI API required</span></section>}
    {!hydrated && <span className="sr-only">Loading saved catalog and shelf configurations</span>}
    {showQuickDoor && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowQuickDoor(false); }}><div className="quick-door-modal"><div className="product-modal-header"><div><h2>Add a shelf / door</h2><p>{location?.name} <ChevronDown size={10}/> {aisle?.name} aisle</p></div><button className="modal-close" onClick={() => setShowQuickDoor(false)} aria-label="Close"><X size={17}/></button></div><div className="quick-door-fields"><label className="form-field quick-wide"><span>Shelf / door name <i>*</i></span><input autoFocus value={quickDoor.name} onChange={e => setQuickDoor(current => ({ ...current, name: e.target.value }))} placeholder="e.g. Door 6"/></label><div className="quick-door-field-row"><label className="form-field"><span>Width <i>*</i> <small>in</small></span><input type="number" min="0.1" max="1000" step="0.1" value={quickDoor.width} onChange={e => setQuickDoor(current => ({ ...current, width: Number(e.target.value) }))}/></label><label className="form-field"><span>Height <i>*</i> <small>in</small></span><input type="number" min="0.1" max="1000" step="0.1" value={quickDoor.height} onChange={e => setQuickDoor(current => ({ ...current, height: Number(e.target.value) }))}/></label><label className="form-field"><span>Depth <i>*</i> <small>in</small></span><input type="number" min="0.1" max="1000" step="0.1" value={quickDoor.depth} onChange={e => setQuickDoor(current => ({ ...current, depth: Number(e.target.value) }))}/></label></div><label className="form-field quick-wide"><span>Number of levels <i>*</i></span><select value={quickDoor.levelHeights.length} onChange={e => setQuickLevelCount(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option value={i + 1} key={i}>{i + 1} {i === 0 ? "level" : "levels"}</option>)}</select></label><div className="quick-level-grid quick-wide">{quickDoor.levelHeights.map((height, index) => <label className="form-field" key={index}><span>Level {index + 1} clear height <i>*</i></span><div className="unit-input"><input type="number" min="0.1" max="1000" step="0.1" value={height} onChange={e => setQuickDoor(current => ({ ...current, levelHeights: current.levelHeights.map((value, i) => i === index ? Number(e.target.value) : value) }))}/><span>in</span></div></label>)}</div><div className="quick-door-hint"><Info size={12}/> Level heights must fit within the {quickDoor.height}″ overall height.</div></div>{quickError && <div className="form-error quick-error">{quickError}</div>}<div className="product-modal-footer"><span>Saved to this aisle</span><div><button className="secondary-button" onClick={() => setShowQuickDoor(false)}>Cancel</button><button className="primary-button" onClick={saveQuickDoor}><Plus size={13}/> Add door</button></div></div></div></div>}
    {showSave && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowSave(false); }}><div className="save-plan-modal"><div className="product-modal-header"><div><h2>{savedId ? "Save planogram changes" : "Save planogram"}</h2><p>Give this shelf layout a name your team can find later.</p></div><button className="modal-close" onClick={() => setShowSave(false)} aria-label="Close"><X size={17}/></button></div><label className="form-field"><span>Planogram name <i>*</i></span><input autoFocus value={saveName} onChange={e => setSaveName(e.target.value)} maxLength={80} placeholder="e.g. Summer snacks refresh"/></label>{saveMessage && <div className="form-error">{saveMessage}</div>}<div className="product-modal-footer"><span>Saved in this browser</span><div><button className="secondary-button" onClick={() => setShowSave(false)}>Cancel</button><button className="primary-button" disabled={!saveName.trim()} onClick={saveCurrentPlan}><Check size={14}/>{savedId ? "Save changes" : "Save planogram"}</button></div></div></div></div>}
  </div>;
}
