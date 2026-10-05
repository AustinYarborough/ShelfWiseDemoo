"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Box, Check, ChevronDown, ChevronLeft, ChevronRight, ImagePlus, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from "lucide-react";

export type Product = { id: string; sku: string; name: string; brand: string; category: string; image: string; width: number; height: number; depth: number; velocity: number; inventory: number };
type Draft = Omit<Product, "id">;
const STORAGE_KEY = "shelfwise.products.v1";
export const productCatalogSeed: Product[] = [
  { id: "p-1", sku: "SNK-1042", name: "Sea Salt Kettle Chips", brand: "Good & Gather", category: "Snacks", image: "", width: 6.5, height: 9.2, depth: 3.1, velocity: 18.4, inventory: 246 },
  { id: "p-2", sku: "SNK-1088", name: "Honey BBQ Potato Chips", brand: "Kettle Brand", category: "Snacks", image: "", width: 7, height: 10, depth: 3.4, velocity: 15.2, inventory: 183 },
  { id: "p-3", sku: "SNK-1205", name: "Original Pretzel Twists", brand: "Rold Gold", category: "Snacks", image: "", width: 5.5, height: 8.5, depth: 3.2, velocity: 12.8, inventory: 315 },
  { id: "p-4", sku: "BEV-2011", name: "Sparkling Water · Lime", brand: "Spindrift", category: "Beverages", image: "", width: 2.6, height: 7.4, depth: 2.6, velocity: 22.6, inventory: 408 },
  { id: "p-5", sku: "BEV-2074", name: "Organic Oat Milk", brand: "Oatly", category: "Beverages", image: "", width: 2.8, height: 9.1, depth: 2.1, velocity: 19.1, inventory: 172 },
  { id: "p-6", sku: "BEV-2150", name: "Cold Brew Coffee", brand: "Stōk", category: "Beverages", image: "", width: 2.7, height: 8.2, depth: 2.7, velocity: 16.5, inventory: 96 },
  { id: "p-7", sku: "BRK-3102", name: "Honey Nut Oat Cereal", brand: "Cheerios", category: "Breakfast", image: "", width: 8.2, height: 11.5, depth: 2.2, velocity: 14.7, inventory: 121 },
  { id: "p-8", sku: "BRK-3228", name: "Maple Brown Sugar Oats", brand: "Quaker", category: "Breakfast", image: "", width: 5.1, height: 7.7, depth: 3.2, velocity: 11.3, inventory: 207 },
  { id: "p-9", sku: "PAN-4019", name: "Creamy Peanut Butter", brand: "Jif", category: "Pantry", image: "", width: 3.1, height: 4.8, depth: 3.1, velocity: 13.8, inventory: 264 },
  { id: "p-10", sku: "PAN-4106", name: "Classic Tomato Sauce", brand: "Rao's", category: "Pantry", image: "", width: 3.2, height: 4.4, depth: 3.2, velocity: 10.5, inventory: 138 },
  { id: "p-11", sku: "PER-5013", name: "Daily Moisturizing Lotion", brand: "CeraVe", category: "Personal care", image: "", width: 2.4, height: 6.1, depth: 1.7, velocity: 8.7, inventory: 74 },
  { id: "p-12", sku: "PER-5120", name: "Sensitive Skin Cleanser", brand: "Cetaphil", category: "Personal care", image: "", width: 2.6, height: 6.6, depth: 2.3, velocity: 9.4, inventory: 109 },
];
const blank: Draft = { sku: "", name: "", brand: "", category: "", image: "", width: 0, height: 0, depth: 0, velocity: 0, inventory: 0 };

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some(value => value !== "")) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some(value => value !== "")) rows.push(row);
  return rows;
}

function ProductCatalog() {
  const [products, setProducts] = useState<Product[]>(productCatalogSeed);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [modal, setModal] = useState<"add" | "edit" | "delete" | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const fileInput = useRef<HTMLInputElement>(null);
  const pageSize = 8;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) setProducts(parsed as Product[]);
      }
    } catch { setMessage("Saved catalog data could not be read. Your sample catalog is still available."); }
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(products)); }, [products, loaded]);
  useEffect(() => { if (!message) return; const id = window.setTimeout(() => setMessage(""), 4500); return () => window.clearTimeout(id); }, [message]);

  const categories = useMemo(() => [...new Set(products.map(p => p.category))].sort((a, b) => a.localeCompare(b)), [products]);
  const filtered = useMemo(() => products.filter(p => (category === "All categories" || p.category === category) && `${p.sku} ${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(query.toLowerCase().trim())), [products, category, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalUnits = products.reduce((sum, product) => sum + product.inventory, 0);

  function openAdd() { setSelected(null); setDraft(blank); setError(""); setModal("add"); }
  function openEdit(product: Product) { setSelected(product); setDraft({ ...product }); setError(""); setModal("edit"); }
  function closeModal() { setModal(null); setError(""); }
  function update<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft(current => ({ ...current, [key]: value })); }
  function validate(d: Draft, excludingId?: string): string {
    if (!d.sku.trim() || !d.name.trim() || !d.brand.trim() || !d.category.trim()) return "SKU, product name, brand, and category are required.";
    if ([d.width, d.height, d.depth].some(value => !Number.isFinite(value) || value <= 0 || value > 1000)) return "Width, height, and depth must be greater than 0 and at most 1,000 inches.";
    if (!Number.isFinite(d.velocity) || d.velocity < 0 || d.velocity > 1_000_000) return "Sales velocity must be a number from 0 to 1,000,000 units per day.";
    if (!Number.isInteger(d.inventory) || d.inventory < 0 || d.inventory > 100_000_000) return "Inventory must be a whole number from 0 to 100,000,000 units.";
    if (d.image && !/^https?:\/\//i.test(d.image)) return "Product image must be a full http or https URL.";
    if (products.some(p => p.id !== excludingId && p.sku.trim().toLowerCase() === d.sku.trim().toLowerCase())) return "That SKU already exists. SKUs must be unique.";
    return "";
  }
  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const issue = validate(draft, selected?.id); if (issue) { setError(issue); return; }
    if (modal === "edit" && selected) setProducts(current => current.map(p => p.id === selected.id ? { ...draft, id: selected.id, sku: draft.sku.trim() } : p));
    else setProducts(current => [{ ...draft, id: crypto.randomUUID(), sku: draft.sku.trim() }, ...current]);
    setMessage(modal === "edit" ? "Product updated." : "Product added to your catalog."); closeModal(); setPage(1);
  }
  function deleteProduct() { if (!selected) return; setProducts(current => current.filter(p => p.id !== selected.id)); setMessage(`${selected.name} was removed.`); closeModal(); }

  function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) { setMessage("Choose a .csv file to import products."); return; }
    if (file.size > 5 * 1024 * 1024) { setMessage("CSV files must be smaller than 5 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result ?? ""));
      if (rows.length < 2) { setMessage("The CSV needs a header row and at least one product row."); return; }
      const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
      const headers = rows[0].map(normalize);
      const col = (...names: string[]) => headers.findIndex(header => names.includes(header));
      const indexes = { sku: col("sku"), name: col("name", "productname"), brand: col("brand"), category: col("category"), image: col("image", "imageurl", "productimage"), width: col("width", "widthin", "widthinches"), height: col("height", "heightin", "heightinches"), depth: col("depth", "depthin", "depthinches"), velocity: col("salesvelocity", "velocity", "unitsperday"), inventory: col("inventory", "inventoryquantity", "quantity", "stock") };
      const required = ["sku", "name", "brand", "category", "width", "height", "depth", "velocity", "inventory"] as const;
      const missing = required.filter(key => indexes[key] < 0);
      if (missing.length) { setMessage(`Missing CSV columns: ${missing.join(", ")}. Download the template for the expected format.`); return; }
      const existingSkus = new Set(products.map(p => p.sku.toLowerCase()));
      let skipped = 0; const accepted: Product[] = [];
      for (const [index, row] of rows.slice(1).entries()) {
        const cell = (key: keyof typeof indexes) => indexes[key] < 0 ? "" : (row[indexes[key]] ?? "").trim();
        const numeric = (key: keyof typeof indexes) => Number(cell(key));
        const d: Draft = { sku: cell("sku"), name: cell("name"), brand: cell("brand"), category: cell("category"), image: cell("image"), width: numeric("width"), height: numeric("height"), depth: numeric("depth"), velocity: numeric("velocity"), inventory: numeric("inventory") };
        if (validate(d) || existingSkus.has(d.sku.toLowerCase())) { skipped++; continue; }
        existingSkus.add(d.sku.toLowerCase()); accepted.push({ ...d, id: `csv-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}` });
      }
      if (accepted.length) { setProducts(current => [...accepted, ...current]); setPage(1); }
      setMessage(`${accepted.length} product${accepted.length === 1 ? "" : "s"} imported${skipped ? `; ${skipped} invalid or duplicate row${skipped === 1 ? " was" : "s were"} skipped` : ""}.`);
    };
    reader.onerror = () => setMessage("The CSV file could not be read."); reader.readAsText(file);
  }
  function downloadTemplate() {
    const csv = "SKU,Product Name,Brand,Category,Image URL,Width (in),Height (in),Depth (in),Sales Velocity,Inventory Quantity\nSKU-1001,Example Product,Example Brand,Snacks,,6.5,9.2,3.1,18.4,246\n";
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); link.download = "shelfwise-product-template.csv"; link.click(); URL.revokeObjectURL(link.href);
  }
  const brandColor = (brand: string) => { let hash = 0; for (const char of brand) hash = char.charCodeAt(0) + ((hash << 5) - hash); return ["#edf1fb", "#f7eee7", "#edf5ee", "#f4eef8", "#f8f2e8"][Math.abs(hash) % 5]; };

  return <div className="content catalog-content">
    <div className="page-heading catalog-heading"><div><div className="eyebrow">MERCHANDISING</div><h1>Product catalog</h1><p>Manage the products your team places on shelves.</p></div><div className="catalog-actions"><input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={importCsv}/><button className="secondary-button" onClick={() => fileInput.current?.click()}><ArrowUpFromLine size={15}/> Import CSV</button><button className="primary-button" onClick={openAdd}><Plus size={16}/> Add product</button></div></div>
    <section className="catalog-stats"><div className="card catalog-stat"><span className="catalog-stat-icon"><Box size={16}/></span><div><small>Products in catalog</small><strong>{products.length.toLocaleString()}</strong></div></div><div className="card catalog-stat"><span className="catalog-stat-icon"><span className="category-dots">•••</span></span><div><small>Active categories</small><strong>{categories.length}</strong></div></div><div className="card catalog-stat"><span className="catalog-stat-icon inventory-icon">▤</span><div><small>Total inventory</small><strong>{totalUnits.toLocaleString()} <em>units</em></strong></div></div></section>
    <section className="card catalog-card"><div className="catalog-toolbar"><div className="catalog-search"><Search size={16}/><input aria-label="Search products" placeholder="Search by name, SKU, or brand..." value={query} onChange={e => { setQuery(e.target.value); setPage(1); }}/>{query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={14}/></button>}</div><label className="category-select-label"><span className="sr-only">Filter by category</span><select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}><option>All categories</option>{categories.map(item => <option key={item}>{item}</option>)}</select><ChevronDown size={14}/></label><button className="template-link" onClick={downloadTemplate}><ArrowDownToLine size={14}/> CSV template</button></div>
      <div className="catalog-table-wrap"><table className="catalog-table"><thead><tr><th className="product-th">PRODUCT</th><th>SKU</th><th>CATEGORY</th><th>DIMENSIONS <span>(W × H × D)</span></th><th>SALES / DAY</th><th>INVENTORY</th><th aria-label="Actions"/></tr></thead><tbody>{visible.map(product => <tr key={product.id}><td><div className="catalog-product">{product.image ? <img className="product-image" src={product.image} alt="" onError={e => { e.currentTarget.style.display = "none"; }}/> : <span className="product-image product-image-placeholder" style={{ background: brandColor(product.brand) }}>{product.brand.slice(0, 1).toUpperCase()}</span>}<span className="product-copy"><strong>{product.name}</strong><small>{product.brand}</small></span></div></td><td><code>{product.sku}</code></td><td><span className="category-pill">{product.category}</span></td><td className="dimension-cell">{product.width} × {product.height} × {product.depth} <span>in</span></td><td className="velocity-cell">{product.velocity.toLocaleString(undefined, { maximumFractionDigits: 2 })}<small>units</small></td><td><span className={`inventory-count ${product.inventory < 100 ? "low" : ""}`}>{product.inventory.toLocaleString()}</span><span className="inventory-unit"> units</span></td><td><div className="product-row-actions"><button aria-label={`Edit ${product.name}`} title="Edit product" onClick={() => openEdit(product)}><Pencil size={14}/></button><button aria-label={`Delete ${product.name}`} title="Delete product" onClick={() => { setSelected(product); setModal("delete"); }}><Trash2 size={14}/></button></div></td></tr>)}</tbody></table>
        {visible.length === 0 && <div className="catalog-empty"><span><Search size={19}/></span><strong>{products.length ? "No products match your search" : "Your catalog is empty"}</strong><p>{products.length ? "Try a different product name, SKU, or category." : "Add a product or import a CSV to get started."}</p>{products.length ? <button className="text-link" onClick={() => { setQuery(""); setCategory("All categories"); }}>Clear filters</button> : <button className="primary-button" onClick={openAdd}><Plus size={15}/> Add first product</button>}</div>}
      </div><div className="catalog-footer"><span>Showing <strong>{filtered.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)}</strong> of <strong>{filtered.length}</strong> products</span><div className="pagination"><button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={15}/></button><span>Page {page} of {pageCount}</span><button aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}><ChevronRight size={15}/></button></div></div></section>
    <div className="catalog-footnote"><span><Check size={13}/> Catalog changes are saved in this browser.</span><span>Dimensions are in inches · Sales velocity is units per day</span></div>
    {message && <div className="catalog-message"><span className="toast-check"><Check size={12}/></span>{message}<button aria-label="Dismiss message" onClick={() => setMessage("")}><X size={14}/></button></div>}
    {modal === "add" || modal === "edit" ? <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) closeModal(); }}><form className="product-modal" onSubmit={submitProduct}><div className="product-modal-header"><div><h2>{modal === "edit" ? "Edit product" : "Add a product"}</h2><p>Product details and shelf dimensions</p></div><button type="button" className="modal-close" aria-label="Close" onClick={closeModal}><X size={17}/></button></div><div className="product-form-grid"><label className="form-field"><span>Product name <i>*</i></span><input autoFocus value={draft.name} onChange={e => update("name", e.target.value)} placeholder="e.g. Sea Salt Kettle Chips" required/></label><label className="form-field"><span>SKU <i>*</i></span><input value={draft.sku} onChange={e => update("sku", e.target.value)} placeholder="e.g. SNK-1042" required/></label><label className="form-field"><span>Brand <i>*</i></span><input value={draft.brand} onChange={e => update("brand", e.target.value)} placeholder="Brand name" required/></label><label className="form-field"><span>Category <i>*</i></span><input list="catalog-categories" value={draft.category} onChange={e => update("category", e.target.value)} placeholder="Select or type a category" required/><datalist id="catalog-categories">{categories.map(c => <option key={c} value={c}/>)}</datalist></label><label className="form-field form-wide"><span>Product image URL <small>Optional</small></span><div className="input-with-icon"><ImagePlus size={15}/><input type="url" value={draft.image} onChange={e => update("image", e.target.value)} placeholder="https://example.com/product.jpg"/></div></label><div className="form-section-label">PRODUCT DIMENSIONS <small>inches</small></div><label className="form-field"><span>Width <i>*</i></span><input type="number" min="0.01" max="1000" step="0.01" value={draft.width || ""} onChange={e => update("width", Number(e.target.value))} placeholder="0.00" required/></label><label className="form-field"><span>Height <i>*</i></span><input type="number" min="0.01" max="1000" step="0.01" value={draft.height || ""} onChange={e => update("height", Number(e.target.value))} placeholder="0.00" required/></label><label className="form-field"><span>Depth <i>*</i></span><input type="number" min="0.01" max="1000" step="0.01" value={draft.depth || ""} onChange={e => update("depth", Number(e.target.value))} placeholder="0.00" required/></label><div className="form-section-label">STORE PERFORMANCE</div><label className="form-field"><span>Sales velocity <small>units / day</small></span><input type="number" min="0" max="1000000" step="0.1" value={draft.velocity} onChange={e => update("velocity", Number(e.target.value))} required/></label><label className="form-field"><span>Inventory quantity <small>units</small></span><input type="number" min="0" max="100000000" step="1" value={draft.inventory} onChange={e => update("inventory", Number(e.target.value))} required/></label></div>{error && <div className="form-error">{error}</div>}<div className="product-modal-footer"><span><i>*</i> Required fields</span><div><button type="button" className="secondary-button" onClick={closeModal}>Cancel</button><button type="submit" className="primary-button"><Check size={14}/>{modal === "edit" ? "Save changes" : "Add product"}</button></div></div></form></div> : null}
    {modal === "delete" && selected && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) closeModal(); }}><div className="confirm-modal"><div className="delete-icon"><Trash2 size={19}/></div><h2>Delete product?</h2><p><strong>{selected.name}</strong> ({selected.sku}) will be removed from this catalog. This action can’t be undone.</p><div className="confirm-actions"><button className="secondary-button" onClick={closeModal}>Cancel</button><button className="danger-button" onClick={deleteProduct}><Trash2 size={14}/> Delete product</button></div></div></div>}
  </div>;
}

export default ProductCatalog;
