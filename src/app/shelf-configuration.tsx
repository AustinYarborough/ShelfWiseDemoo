"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, ChevronDown, ChevronRight, Grid2X2, Info, Layers3, MapPin, Pencil, Plus, Ruler, Store, Trash2, X } from "lucide-react";
import Shelf3DView from "./shelf-3d-view";
import SavedPlanograms from "./saved-planograms";
import Aisle3DView from "./aisle-3d-view";
import { PENDING_SHELF_KEY, readPlanograms, writePlanograms, type SavedPlanogram } from "./planogram-storage";

export type StoreLocation = { id: string; name: string; address: string };
export type AisleRecord = { id: string; locationId: string; name: string; category: string };
export type ShelfRecord = { id: string; name: string; width: number; height: number; depth: number; levelHeights: number[]; updatedAt: string; locationId?: string; locationName?: string; aisleId?: string; aisleName?: string };
type ShelfDraft = Omit<ShelfRecord, "id" | "updatedAt">;
type Modal = "location" | "aisle" | "shelf" | "delete" | null;
type DeleteTarget = "location" | "aisle" | "shelf";

const SHELF_KEY = "shelfwise.shelves.v1";
const LOCATION_KEY = "shelfwise.locations.v1";
const AISLE_KEY = "shelfwise.aisles.v1";
export const storeLocationSeed: StoreLocation[] = [
  { id: "loc-downtown", name: "Northstar · Downtown", address: "124 Market Street" },
  { id: "loc-westside", name: "Northstar · Westside", address: "8800 West Avenue" },
];
export const aisleSeed: AisleRecord[] = [
  { id: "aisle-beer-downtown", locationId: "loc-downtown", name: "Beer", category: "Beer & cider" },
  { id: "aisle-snacks-downtown", locationId: "loc-downtown", name: "Snacks", category: "Snacks" },
  { id: "aisle-coolers-westside", locationId: "loc-westside", name: "Cold drinks", category: "Beverages" },
];
const makeShelf = (id: string, name: string, locationId: string, locationName: string, aisleId: string, aisleName: string, width: number, height: number, depth: number, levels: number[], updatedAt = "Sample configuration"): ShelfRecord => ({ id, name, locationId, locationName, aisleId, aisleName, width, height, depth, levelHeights: levels, updatedAt });
export const shelfConfigurationSeed: ShelfRecord[] = [
  makeShelf("door-beer-1", "Door 1", "loc-downtown", "Northstar · Downtown", "aisle-beer-downtown", "Beer", 36, 78, 24, [15, 15, 15, 15]),
  makeShelf("door-beer-2", "Door 2", "loc-downtown", "Northstar · Downtown", "aisle-beer-downtown", "Beer", 36, 78, 24, [14, 14, 14, 14, 14]),
  makeShelf("door-beer-3", "Door 3", "loc-downtown", "Northstar · Downtown", "aisle-beer-downtown", "Beer", 36, 84, 24, [16, 16, 16, 16]),
  makeShelf("door-beer-4", "Door 4", "loc-downtown", "Northstar · Downtown", "aisle-beer-downtown", "Beer", 36, 78, 22, [15, 15, 15, 15]),
  makeShelf("door-beer-5", "Door 5", "loc-downtown", "Northstar · Downtown", "aisle-beer-downtown", "Beer", 48, 84, 24, [16, 16, 16, 16]),
  makeShelf("shelf-snacks-1", "Grocery bay 1", "loc-downtown", "Northstar · Downtown", "aisle-snacks-downtown", "Snacks", 48, 72, 20, [15, 15, 15, 15]),
  makeShelf("door-cold-1", "Cooler 1", "loc-westside", "Northstar · Westside", "aisle-coolers-westside", "Cold drinks", 36, 78, 24, [15, 15, 15, 15]),
  makeShelf("door-cold-2", "Cooler 2", "loc-westside", "Northstar · Westside", "aisle-coolers-westside", "Cold drinks", 36, 78, 24, [15, 15, 15, 15]),
  makeShelf("door-cold-3", "Cooler 3", "loc-westside", "Northstar · Westside", "aisle-coolers-westside", "Cold drinks", 30, 72, 22, [14, 14, 14, 14]),
];
const emptyDraft = (locationId: string, locationName: string, aisleId: string, aisleName: string): ShelfDraft => ({ name: "", locationId, locationName, aisleId, aisleName, width: 36, height: 78, depth: 24, levelHeights: [15, 15, 15, 15] });
const inches = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");

function ShelfPreview({ shelf, compact = false }: { shelf: Pick<ShelfDraft, "name" | "width" | "height" | "depth" | "levelHeights">; compact?: boolean }) {
  return <div className={`shelf-preview shelf-3d-preview ${compact ? "shelf-preview-compact" : ""}`}><Shelf3DView shelf={shelf} compact/></div>;
}

export default function ShelfConfiguration({ onOpenPlanogramBuilder }: { onOpenPlanogramBuilder: () => void }) {
  const [locations, setLocations] = useState<StoreLocation[]>(storeLocationSeed);
  const [aisles, setAisles] = useState<AisleRecord[]>(aisleSeed);
  const [shelves, setShelves] = useState<ShelfRecord[]>(shelfConfigurationSeed);
  const [locationId, setLocationId] = useState(storeLocationSeed[0].id);
  const [aisleId, setAisleId] = useState(aisleSeed[0].id);
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>("shelf");
  const [selectedLocation, setSelectedLocation] = useState<StoreLocation | null>(null);
  const [selectedAisle, setSelectedAisle] = useState<AisleRecord | null>(null);
  const [selectedShelf, setSelectedShelf] = useState<ShelfRecord | null>(null);
  const [shelfDraft, setShelfDraft] = useState<ShelfDraft>(emptyDraft(storeLocationSeed[0].id, storeLocationSeed[0].name, aisleSeed[0].id, aisleSeed[0].name));
  const [nameDraft, setNameDraft] = useState("");
  const [addressDraft, setAddressDraft] = useState("");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedShelfId, setSelectedShelfId] = useState(shelfConfigurationSeed[0].id);
  const [planograms, setPlanograms] = useState<SavedPlanogram[]>([]);
  const [showPlanogramManager, setShowPlanogramManager] = useState(false);

  useEffect(() => {
    try {
      const rawLocations = localStorage.getItem(LOCATION_KEY);
      const rawAisles = localStorage.getItem(AISLE_KEY);
      const rawShelves = localStorage.getItem(SHELF_KEY);
      const savedLocations: unknown = rawLocations ? JSON.parse(rawLocations) : null;
      const savedAisles: unknown = rawAisles ? JSON.parse(rawAisles) : null;
      const savedShelves: unknown = rawShelves ? JSON.parse(rawShelves) : null;
      const hasLocations = Array.isArray(savedLocations);
      const hasAisles = Array.isArray(savedAisles);
      const nextLocations: StoreLocation[] = hasLocations ? savedLocations as StoreLocation[] : storeLocationSeed;
      let nextAisles: AisleRecord[] = hasAisles ? savedAisles as AisleRecord[] : aisleSeed;
      let nextShelves: ShelfRecord[] = Array.isArray(savedShelves) ? savedShelves as ShelfRecord[] : shelfConfigurationSeed;
      // Migrate existing Stage 3 shelves into an explicit location and an "Existing shelves" aisle.
      if (Array.isArray(savedShelves) && !hasAisles && savedShelves.length) {
        const loc = nextLocations[0] ?? storeLocationSeed[0];
        const legacyAisle = { id: "aisle-existing-migration", locationId: loc.id, name: "Existing shelves", category: "" };
        nextAisles = [...nextAisles, legacyAisle];
        nextShelves = [...shelfConfigurationSeed, ...(savedShelves as ShelfRecord[]).map(item => ({ ...item, locationId: loc.id, locationName: loc.name, aisleId: legacyAisle.id, aisleName: legacyAisle.name }))];
      } else if (Array.isArray(savedShelves)) {
        nextShelves = (savedShelves as ShelfRecord[]).map(item => {
          const loc = nextLocations.find(entry => entry.id === item.locationId) ?? nextLocations[0];
          const aisle = nextAisles.find(entry => entry.id === item.aisleId) ?? nextAisles.find(entry => entry.locationId === loc?.id) ?? nextAisles[0];
          return { ...item, locationId: item.locationId ?? loc?.id, locationName: item.locationName ?? loc?.name, aisleId: item.aisleId ?? aisle?.id, aisleName: item.aisleName ?? aisle?.name };
        });
      }
      // Attach legacy single-shelf layouts to a fixture only when the complete dimensions identify one unique match.
      const savedPlans = readPlanograms();
      let plansMigrated = false;
      const normalizedPlans = savedPlans.map(plan => {
        const sameShelf = nextShelves.find(item => item.id === plan.shelf.id);
        if (sameShelf) {
          const shelf = { ...plan.shelf, locationId: plan.shelf.locationId ?? sameShelf.locationId, locationName: plan.shelf.locationName ?? sameShelf.locationName, aisleId: plan.shelf.aisleId ?? sameShelf.aisleId, aisleName: plan.shelf.aisleName ?? sameShelf.aisleName };
          if (shelf.locationName !== plan.shelf.locationName || shelf.aisleName !== plan.shelf.aisleName) plansMigrated = true;
          return { ...plan, shelf };
        }
        const nameMatches = nextShelves.filter(item => item.name.trim().toLowerCase() === plan.shelf.name.trim().toLowerCase());
        const matches = nameMatches.length ? nameMatches : nextShelves.filter(item => item.width === plan.shelf.width && item.height === plan.shelf.height && item.depth === plan.shelf.depth && item.levelHeights.join(",") === plan.shelf.levelHeights.join(","));
        if (matches.length !== 1) return plan;
        plansMigrated = true;
        return { ...plan, shelf: { ...plan.shelf, ...matches[0] } };
      });
      if (plansMigrated) writePlanograms(normalizedPlans);
      setPlanograms(normalizedPlans);
      setLocations(nextLocations); setAisles(nextAisles); setShelves(nextShelves);
      const firstLocation = nextLocations[0];
      const firstAisle = nextAisles.find(item => item.locationId === firstLocation?.id);
      setLocationId(firstLocation?.id ?? ""); setAisleId(firstAisle?.id ?? "");
    } catch { setMessage("Saved store setup could not be loaded. Sample locations are available."); }
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) { localStorage.setItem(LOCATION_KEY, JSON.stringify(locations)); localStorage.setItem(AISLE_KEY, JSON.stringify(aisles)); localStorage.setItem(SHELF_KEY, JSON.stringify(shelves)); } }, [locations, aisles, shelves, loaded]);
  useEffect(() => { if (!message) return; const id = window.setTimeout(() => setMessage(""), 4000); return () => window.clearTimeout(id); }, [message]);

  const location = locations.find(item => item.id === locationId) ?? null;
  const locationAisles = useMemo(() => aisles.filter(item => item.locationId === locationId), [aisles, locationId]);
  const aisle = locationAisles.find(item => item.id === aisleId) ?? locationAisles[0] ?? null;
  const aisleShelves = shelves.filter(item => item.locationId === locationId && item.aisleId === aisle?.id);
  const storeShelfCount = shelves.filter(item => item.locationId === locationId).length;
  const totalLevels = aisleShelves.reduce((sum, item) => sum + item.levelHeights.length, 0);
  const activeShelf = aisleShelves.find(item => item.id === selectedShelfId) ?? aisleShelves[0] ?? null;
  const activePlanogram = activeShelf ? planograms.filter(plan => plan.shelf.id === activeShelf.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] : undefined;
  const syncPlanograms = useCallback((next: SavedPlanogram[]) => setPlanograms(next), []);

  function close() { setModal(null); setError(""); }
  function openLocation(loc?: StoreLocation) { setSelectedLocation(loc ?? null); setNameDraft(loc?.name ?? ""); setAddressDraft(loc?.address ?? ""); setModal("location"); setError(""); }
  function openAisle(item?: AisleRecord) { setSelectedAisle(item ?? null); setNameDraft(item?.name ?? ""); setCategoryDraft(item?.category ?? ""); setModal("aisle"); setError(""); }
  function openShelf(item?: ShelfRecord) {
    setSelectedShelf(item ?? null);
    setShelfDraft(item ? { name: item.name, width: item.width, height: item.height, depth: item.depth, levelHeights: [...item.levelHeights], locationId, locationName: location?.name ?? "", aisleId: aisle?.id ?? "", aisleName: aisle?.name ?? "" } : emptyDraft(locationId, location?.name ?? "", aisle?.id ?? "", aisle?.name ?? ""));
    setModal("shelf"); setError("");
  }
  function deleteConfirm(target: DeleteTarget, item: StoreLocation | AisleRecord | ShelfRecord) {
    setDeleteTarget(target);
    if (target === "location") setSelectedLocation(item as StoreLocation);
    if (target === "aisle") setSelectedAisle(item as AisleRecord);
    if (target === "shelf") setSelectedShelf(item as ShelfRecord);
    setModal("delete");
  }
  function saveLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const name = nameDraft.trim();
    if (!name) return setError("Enter a name for this store location.");
    if (locations.some(item => item.id !== selectedLocation?.id && item.name.toLowerCase() === name.toLowerCase())) return setError("A store location with this name already exists.");
    if (selectedLocation) {
      setLocations(current => current.map(item => item.id === selectedLocation.id ? { ...item, name, address: addressDraft.trim() } : item));
      setAisles(current => current.map(item => item.locationId === selectedLocation.id ? { ...item } : item));
      setShelves(current => current.map(item => item.locationId === selectedLocation.id ? { ...item, locationName: name } : item));
      setMessage("Store location updated.");
    } else {
      const created = { id: crypto.randomUUID(), name, address: addressDraft.trim() };
      setLocations(current => [...current, created]); setLocationId(created.id); setAisleId(""); setMessage("Store location created. Add an aisle to get started.");
    }
    close();
  }
  function saveAisle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const name = nameDraft.trim();
    if (!name) return setError("Enter a name for this aisle.");
    if (!location) return setError("Create or select a store location first.");
    if (aisles.some(item => item.locationId === location.id && item.id !== selectedAisle?.id && item.name.toLowerCase() === name.toLowerCase())) return setError("An aisle with this name already exists at this location.");
    if (selectedAisle) {
      setAisles(current => current.map(item => item.id === selectedAisle.id ? { ...item, name, category: categoryDraft.trim() } : item));
      setShelves(current => current.map(item => item.aisleId === selectedAisle.id ? { ...item, aisleName: name } : item)); setMessage("Aisle updated.");
    } else {
      const created = { id: crypto.randomUUID(), locationId: location.id, name, category: categoryDraft.trim() };
      setAisles(current => [...current, created]); setAisleId(created.id); setMessage("Aisle created. Add shelf doors to this aisle.");
    }
    close();
  }
  function setDimension(key: "width" | "height" | "depth", value: number) { setShelfDraft(current => ({ ...current, [key]: value })); }
  function setLevelCount(count: number) {
    const safeCount = Math.min(12, Math.max(1, Number.isFinite(count) ? Math.floor(count) : 1));
    setShelfDraft(current => { const levels = [...current.levelHeights]; if (safeCount > levels.length) { const average = Math.max(1, Math.floor(current.height / safeCount)); while (levels.length < safeCount) levels.push(average); } else levels.length = safeCount; return { ...current, levelHeights: levels }; });
  }
  function setLevelHeight(index: number, value: number) { setShelfDraft(current => ({ ...current, levelHeights: current.levelHeights.map((h, i) => i === index ? value : h) })); }
  function validateShelf() {
    if (!shelfDraft.name.trim()) return "Enter a name for this shelf or door.";
    for (const [label, value] of [["Width", shelfDraft.width], ["Height", shelfDraft.height], ["Depth", shelfDraft.depth]] as const) if (!Number.isFinite(value) || value <= 0 || value > 1000) return `${label} must be greater than 0 and at most 1,000 inches.`;
    if (shelfDraft.levelHeights.length < 1 || shelfDraft.levelHeights.length > 12) return "A shelf must have between 1 and 12 levels.";
    if (shelfDraft.levelHeights.some(h => !Number.isFinite(h) || h <= 0 || h > 1000)) return "Each level height must be greater than 0 and at most 1,000 inches.";
    const total = shelfDraft.levelHeights.reduce((sum, h) => sum + h, 0);
    if (total > shelfDraft.height) return `Level heights total ${inches(total)}″, which exceeds this shelf's height of ${inches(shelfDraft.height)}″.`;
    if (shelves.some(item => item.aisleId === aisle?.id && item.id !== selectedShelf?.id && item.name.trim().toLowerCase() === shelfDraft.name.trim().toLowerCase())) return "A shelf or door with this name already exists in this aisle.";
    return "";
  }
  function saveShelf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const issue = validateShelf(); if (issue) return setError(issue);
    const saved: ShelfRecord = { ...shelfDraft, name: shelfDraft.name.trim(), id: selectedShelf?.id ?? crypto.randomUUID(), updatedAt: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) };
    setShelves(current => selectedShelf ? current.map(item => item.id === selectedShelf.id ? saved : item) : [...current, saved]);
    setMessage(selectedShelf ? "Shelf dimensions updated." : `${saved.name} added to ${aisle?.name ?? "aisle"}.`); close();
  }
  function removeSelected() {
    if (deleteTarget === "shelf" && selectedShelf) { setShelves(current => current.filter(item => item.id !== selectedShelf.id)); setMessage(`${selectedShelf.name} removed from ${selectedShelf.aisleName ?? "aisle"}.`); }
    if (deleteTarget === "aisle" && selectedAisle) {
      setAisles(current => current.filter(item => item.id !== selectedAisle.id)); setShelves(current => current.filter(item => item.aisleId !== selectedAisle.id));
      if (aisleId === selectedAisle.id) setAisleId(locationAisles.find(item => item.id !== selectedAisle.id)?.id ?? ""); setMessage(`${selectedAisle.name} aisle and its shelf doors were deleted.`);
    }
    if (deleteTarget === "location" && selectedLocation) {
      const removedAisles = aisles.filter(item => item.locationId === selectedLocation.id).map(item => item.id);
      setLocations(current => current.filter(item => item.id !== selectedLocation.id)); setAisles(current => current.filter(item => item.locationId !== selectedLocation.id)); setShelves(current => current.filter(item => item.locationId !== selectedLocation.id));
      if (locationId === selectedLocation.id) { const next = locations.find(item => item.id !== selectedLocation.id); setLocationId(next?.id ?? ""); setAisleId(aisles.find(item => item.locationId === next?.id)?.id ?? ""); }
      setMessage(`${selectedLocation.name}, ${removedAisles.length} aisle${removedAisles.length === 1 ? "" : "s"}, and its shelves were deleted.`);
    }
    close();
  }

  return <div className="content shelves-content">
    <div className="page-heading shelves-heading"><div><div className="eyebrow">STORE SETUP</div><h1>Store layout</h1><p>Organize locations into aisles, then inspect every fixture in one interactive 3D view.</p></div><div className="store-header-actions"><button className="secondary-button" onClick={() => openLocation()}><Plus size={14}/> Add location</button>{aisle && <button className="primary-button" onClick={() => openShelf()}><Plus size={15}/> Add shelf / door</button>}</div></div>
    <div className="store-flow"><span className="flow-step active"><i>1</i> Store location</span><ChevronRight size={14}/><span className={location ? "flow-step active" : "flow-step"}><i>2</i> Aisle</span><ChevronRight size={14}/><span className={aisle ? "flow-step active" : "flow-step"}><i>3</i> Shelves / doors</span><span className="flow-caption">Every shelf keeps its own dimensions and level heights</span></div>
    <section className="store-location-panel card"><div className="location-panel-heading"><div className="location-heading-icon"><MapPin size={16}/></div><div><small>STORE LOCATIONS</small><strong>Choose a location</strong></div><span className="location-total">{locations.length} {locations.length === 1 ? "location" : "locations"}</span></div><div className="location-list">{locations.map(item => { const active = item.id === locationId; return <div key={item.id} className={`location-card ${active ? "active" : ""}`}><button className="location-card-main" onClick={() => { setLocationId(item.id); setAisleId(aisles.find(aisleItem => aisleItem.locationId === item.id)?.id ?? ""); setShowPlanogramManager(false); }}><span className="location-card-mark"><Store size={15}/></span><span className="location-card-copy"><strong>{item.name}</strong><small>{item.address || "Store location"}</small></span><span className="location-shelf-count">{shelves.filter(sh => sh.locationId === item.id).length} shelves</span></button><div className="location-card-actions"><button aria-label={`Rename ${item.name}`} title="Edit location" onClick={() => openLocation(item)}><Pencil size={12}/></button><button aria-label={`Delete ${item.name}`} title="Delete location" onClick={() => deleteConfirm("location", item)}><Trash2 size={12}/></button></div></div>; })}<button className="location-add-card" onClick={() => openLocation()}><Plus size={15}/><span>Add store location</span></button></div></section>
    {location ? <section className="aisle-section"><div className="aisle-section-heading"><div><div className="hierarchy-kicker"><span>LOCATION</span><ChevronRight size={11}/><b>{location.name}</b></div><h2>Aisles <span>{locationAisles.length}</span></h2><p>Select an aisle to view and configure its shelf doors.</p></div><button className="secondary-button aisle-add-button" onClick={() => openAisle()}><Plus size={14}/> Create aisle</button></div>
      {locationAisles.length ? <div className="aisle-card-list">{locationAisles.map(item => { const count = shelves.filter(sh => sh.aisleId === item.id).length; const active = item.id === aisle?.id; return <div className={`aisle-card ${active ? "active" : ""}`} key={item.id}><button className="aisle-card-main" onClick={() => { setAisleId(item.id); setShowPlanogramManager(false); }}><span className="aisle-card-number">{String(locationAisles.indexOf(item) + 1).padStart(2, "0")}</span><span className="aisle-card-copy"><strong>{item.name}</strong><small>{item.category || "Merchandising aisle"}</small></span><span className="aisle-door-count">{count}<small>{count === 1 ? "shelf / door" : "shelves / doors"}</small></span><ChevronRight size={14}/></button><div className="aisle-card-actions"><button aria-label={`Edit ${item.name} aisle`} title="Edit aisle" onClick={() => openAisle(item)}><Pencil size={12}/></button><button aria-label={`Delete ${item.name} aisle`} title="Delete aisle" onClick={() => deleteConfirm("aisle", item)}><Trash2 size={12}/></button></div></div>; })}<button className="aisle-create-tile" onClick={() => openAisle()}><span><Plus size={15}/></span><strong>Create another aisle</strong><small>Organize another product section</small></button></div> : <div className="card shelves-empty"><span><Layers3 size={20}/></span><h3>No aisles at this location</h3><p>Create an aisle—such as Beer, Snacks, or Produce—then add its individual shelf doors.</p><button className="primary-button" onClick={() => openAisle()}><Plus size={14}/> Create first aisle</button></div>}</section> : <div className="card shelves-empty"><span><Store size={20}/></span><h3>No store locations yet</h3><p>Create a store location to start organizing its aisles and shelf doors.</p><button className="primary-button" onClick={() => openLocation()}><Plus size={14}/> Add a location</button></div>}
    {location && aisle && <section className="door-section"><div className="door-section-heading"><div><div className="hierarchy-kicker"><span>{location.name}</span><ChevronRight size={11}/><span>{aisle.name} aisle</span></div><h2>{aisle.name} aisle <span>{aisleShelves.length} doors</span></h2><p>Select any door in the 3D aisle to inspect its planogram, products, and fixture dimensions.</p></div><button className="primary-button" onClick={() => openShelf()}><Plus size={14}/> Add shelf / door</button></div>
      {aisleShelves.length ? <><Aisle3DView shelves={aisleShelves} plans={planograms} selectedShelfId={activeShelf?.id ?? ""} onSelect={id => { setSelectedShelfId(id); setShowPlanogramManager(false); }}/>{activeShelf && <section className="card selected-aisle-fixture"><div className="selected-fixture-summary"><div className="selected-fixture-heading"><span className="shelf-card-icon"><Store size={15}/></span><div><div className="eyebrow">SELECTED DOOR · {aisle.name.toUpperCase()} AISLE</div><h3>{activeShelf.name}</h3><p>{activeShelf.width}″ W × {activeShelf.height}″ H × {activeShelf.depth}″ D <i>·</i> {activeShelf.levelHeights.length} levels</p></div></div><div className="selected-fixture-actions"><button className="secondary-button" onClick={() => openShelf(activeShelf)}><Pencil size={13}/> Edit fixture</button><button className="secondary-button" onClick={() => setShowPlanogramManager(current => !current)}><Grid2X2 size={13}/> {showPlanogramManager ? "Hide planograms" : "Manage planograms"}</button><button className="primary-button" onClick={() => { localStorage.setItem(PENDING_SHELF_KEY, activeShelf.id); onOpenPlanogramBuilder(); }}><Plus size={13}/> Build planogram</button><button className="icon-button" aria-label={`Delete ${activeShelf.name}`} title="Delete door" onClick={() => deleteConfirm("shelf", activeShelf)}><Trash2 size={14}/></button></div></div><div className="selected-fixture-plan"><div><small>ACTIVE PLANOGRAM</small><strong>{activePlanogram?.name ?? "No saved planogram"}</strong><span>{activePlanogram ? `${activePlanogram.placements.flat().length} product positions · Updated ${new Date(activePlanogram.updatedAt).toLocaleDateString()}` : "Build and save a planogram to see products on this door."}</span></div>{activePlanogram && <span className="saved-status"><i/>Saved</span>}</div>{activePlanogram && <div className="selected-fixture-3d"><Shelf3DView shelf={activeShelf} placements={activePlanogram.placements}/></div>}</section>}{showPlanogramManager && <SavedPlanograms key={activeShelf?.id} shelfId={activeShelf?.id} shelfName={activeShelf?.name} embedded onClose={() => setShowPlanogramManager(false)} onOpen={() => { if (activeShelf) localStorage.setItem(PENDING_SHELF_KEY, activeShelf.id); onOpenPlanogramBuilder(); }} onPlanogramsChange={syncPlanograms}/>}</> : <div className="card shelves-empty"><span><Store size={20}/></span><h3>No shelves in {aisle.name} yet</h3><p>Add each fixture or cooler door separately. Dimensions can vary across the aisle.</p><button className="primary-button" onClick={() => openShelf()}><Plus size={14}/> Add first shelf / door</button></div>}</section>}
    <div className="store-setup-note"><Info size={14}/><span>Planograms are built for one shelf / door at a time. Level clear heights must fit within that shelf’s overall height; all dimensions use inches.</span></div>
    {message && <div className="catalog-message"><span className="toast-check"><Check size={12}/></span>{message}<button aria-label="Dismiss" onClick={() => setMessage("")}><X size={14}/></button></div>}
    {(modal === "location" || modal === "aisle") && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><form className="product-modal hierarchy-modal" onSubmit={modal === "location" ? saveLocation : saveAisle}><div className="product-modal-header"><div><h2>{modal === "location" ? selectedLocation ? "Edit store location" : "Add store location" : selectedAisle ? "Edit aisle" : "Create an aisle"}</h2><p>{modal === "location" ? "Add a store your company operates." : `Add a merchandising section at ${location?.name ?? "this location"}.`}</p></div><button type="button" className="modal-close" aria-label="Close" onClick={close}><X size={17}/></button></div><div className="hierarchy-modal-fields"><label className="form-field"><span>{modal === "location" ? "Location name" : "Aisle name"} <i>*</i></span><input autoFocus value={nameDraft} onChange={e => setNameDraft(e.target.value)} placeholder={modal === "location" ? "e.g. Northstar · Downtown" : "e.g. Beer"} required/></label>{modal === "location" ? <label className="form-field"><span>Address <small>Optional</small></span><input value={addressDraft} onChange={e => setAddressDraft(e.target.value)} placeholder="Street, city"/></label> : <label className="form-field"><span>Section / category <small>Optional</small></span><input value={categoryDraft} onChange={e => setCategoryDraft(e.target.value)} placeholder="e.g. Beer & cider"/></label>}</div>{error && <div className="form-error">{error}</div>}<div className="product-modal-footer"><span><i>*</i> Required field</span><div><button type="button" className="secondary-button" onClick={close}>Cancel</button><button type="submit" className="primary-button"><Check size={14}/>{modal === "location" ? "Save location" : "Save aisle"}</button></div></div></form></div>}
    {modal === "shelf" && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><form className="shelf-modal" onSubmit={saveShelf}><div className="product-modal-header"><div><h2>{selectedShelf ? "Edit shelf / door" : "Add a shelf / door"}</h2><p>{location?.name} <ChevronRight size={11}/> {aisle?.name} aisle · set this unit’s dimensions.</p></div><button type="button" className="modal-close" aria-label="Close" onClick={close}><X size={17}/></button></div><div className="shelf-modal-content"><div className="shelf-form-fields"><label className="form-field shelf-form-wide"><span>Shelf / door name <i>*</i></span><input autoFocus value={shelfDraft.name} onChange={e => setShelfDraft(current => ({ ...current, name: e.target.value }))} placeholder="e.g. Door 1" required/></label><div className="form-section-label shelf-form-wide">OVERALL DIMENSIONS <small>inches</small></div><label className="form-field"><span>Width <i>*</i></span><input type="number" min="0.1" max="1000" step="0.1" value={shelfDraft.width || ""} onChange={e => setDimension("width", Number(e.target.value))} required/></label><label className="form-field"><span>Height <i>*</i></span><input type="number" min="0.1" max="1000" step="0.1" value={shelfDraft.height || ""} onChange={e => setDimension("height", Number(e.target.value))} required/></label><label className="form-field shelf-form-wide"><span>Depth <i>*</i></span><input type="number" min="0.1" max="1000" step="0.1" value={shelfDraft.depth || ""} onChange={e => setDimension("depth", Number(e.target.value))} required/></label><div className="form-section-label shelf-form-wide shelf-level-form-heading">SHELF LEVELS <small>Set the clear product height for each level</small></div><label className="form-field shelf-form-wide"><span>Number of levels <i>*</i></span><select value={shelfDraft.levelHeights.length} onChange={e => setLevelCount(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} {i === 0 ? "level" : "levels"}</option>)}</select></label><div className="shelf-level-inputs shelf-form-wide">{shelfDraft.levelHeights.map((height, index) => <label className="form-field" key={index}><span>Level {index + 1} clear height <i>*</i></span><div className="unit-input"><input type="number" min="0.1" max="1000" step="0.1" value={height || ""} onChange={e => setLevelHeight(index, Number(e.target.value))} required/><span>in</span></div></label>)}</div><div className="shelf-height-summary shelf-form-wide"><span>Total configured clear height</span><strong className={shelfDraft.levelHeights.reduce((sum, h) => sum + (Number(h) || 0), 0) > shelfDraft.height ? "over" : ""}>{inches(shelfDraft.levelHeights.reduce((sum, h) => sum + (Number(h) || 0), 0))}″ <small>of {inches(shelfDraft.height || 0)}″</small></strong></div></div><div className="shelf-modal-preview"><div className="preview-label">LIVE PREVIEW · {aisle?.name}</div><div className="preview-measure"><span>HEIGHT</span><strong>{inches(shelfDraft.height || 0)}″</strong></div><ShelfPreview shelf={shelfDraft}/><div className="preview-dimensions"><span><b>{inches(shelfDraft.width || 0)}″</b> wide</span><span><b>{inches(shelfDraft.depth || 0)}″</b> deep</span></div></div></div>{error && <div className="form-error shelf-form-error">{error}</div>}<div className="product-modal-footer"><span><i>*</i> Required fields</span><div><button type="button" className="secondary-button" onClick={close}>Cancel</button><button type="submit" className="primary-button"><Check size={14}/>{selectedShelf ? "Save changes" : "Add shelf / door"}</button></div></div></form></div>}
    {modal === "delete" && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><div className="confirm-modal"><div className="delete-icon"><Trash2 size={19}/></div><h2>{deleteTarget === "location" ? "Delete store location?" : deleteTarget === "aisle" ? "Delete aisle?" : "Delete shelf / door?"}</h2><p>{deleteTarget === "location" ? <> <strong>{selectedLocation?.name}</strong> and its aisles and shelf doors will be removed from this browser.</> : deleteTarget === "aisle" ? <><strong>{selectedAisle?.name}</strong> and its shelf doors will be removed from this location.</> : <><strong>{selectedShelf?.name}</strong> will be removed from this aisle.</>} This action can’t be undone.</p><div className="confirm-actions"><button className="secondary-button" onClick={close}>Cancel</button><button className="danger-button" onClick={removeSelected}><Trash2 size={14}/> Delete {deleteTarget}</button></div></div></div>}
  </div>;
}
