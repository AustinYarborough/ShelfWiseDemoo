# Shelfwise — Retail Merchandising MVP

Stage 1–6 of a retail merchandising SaaS MVP: responsive application shell, dashboard, catalog, store hierarchy, deterministic planogram generation, interactive 2D and isometric 3D views, saved layouts, and printable stocking guides.

## Run locally

Requirements: Node.js 18.17+ and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For a production build, run `npm run build` and then `npm start`.

## File structure

```text
src/
  app/
    globals.css   # Tailwind layers and responsive dashboard styling
    layout.tsx    # Root document and metadata
    page.tsx      # Dashboard and application navigation
    product-catalog.tsx # Searchable catalog, product forms, CRUD, and CSV import
    shelf-configuration.tsx # Shelf setup, level height validation, and live preview
    shelf-3d-view.tsx # Isometric shelf and product geometry based on physical dimensions
    planogram-builder.tsx # Shelf/product selection, facing rules, local instruction parsing, and layout preview
    planogram-optimizer.ts # Deterministic physical placement and merchandising preference mapping
    planogram-editor.tsx # Scaled interactive shelf editor and physical placement validation
    planogram-storage.ts # Browser-local storage for saved planograms
    saved-planograms.tsx # Saved layouts, adjustments, rename/delete, and PDF-ready print view
package.json
next.config.mjs
postcss.config.mjs
tailwind.config.ts
tsconfig.json
```

Products added, edited, deleted, or imported in the catalog are stored in this browser's local storage. CSV files require SKU, Product Name, Brand, Category, Width, Height, Depth, Sales Velocity, and Inventory Quantity columns; Image URL is optional. Use the in-app CSV template for an example.

Store setup follows **Store location → Aisle → Shelf / door**. Create multiple locations, organize their aisles, then configure every shelf or cooler door independently with its own width, height, depth, levels, and clear height per level. The aisle and fixture setup is saved in this browser's local storage. Existing Stage 3 shelves are migrated under an "Existing shelves" aisle.

The **Planogram builder** reads those local catalog and shelf configurations. Choose product facing bounds and priorities, add optional merchandising instructions, and generate a constrained placement preview. Physical fit is determined locally from product and shelf dimensions; the instruction interpreter applies a small set of explicit rules for product/category emphasis, sales velocity, even distribution, and shelf-level preferences. No AI API is configured or implied.

The interactive editor supports drag-and-drop between levels and positions, facing changes, item removal, capacity/utilization updates, and invalid-drop feedback. Physical dimensions constrain every edit.

Use **3D view** in the editor to inspect the fixture and product depth in an isometric view; rotate the viewing angle with the toolbar buttons. Store setup uses the same 3D fixture preview. Switch back to **2D editor** for drag-and-drop placement.

Save an edited layout from the builder. In **Store setup**, open **Planograms** on the matching shelf or door to find its layouts. Layouts can be renamed, deleted, reopened in the builder, adjusted, and exported through the browser print dialog. Choose **Save as PDF** in that dialog for a stocking guide with the visual layout, shelf dimensions, SKUs, facings, and positions. Planogram data is stored in this browser's local storage.

Settings is represented in navigation as an upcoming section. Dashboard metrics remain realistic sample data until the app connects those views to catalog, shelf, and planogram data.
