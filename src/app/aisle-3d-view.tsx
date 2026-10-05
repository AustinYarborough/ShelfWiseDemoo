"use client";

import { useMemo, useRef, useState } from "react";
import { Move3D, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import type { SavedPlanogram } from "./planogram-storage";
import type { ShelfRecord } from "./shelf-configuration";

type Props = { shelves: ShelfRecord[]; plans: SavedPlanogram[]; selectedShelfId: string; onSelect: (shelfId: string) => void };
type Point = { x: number; y: number };
const W = 1000, H = 600;
const colors = ["#d9b157", "#dc806f", "#79ab91", "#7593ca", "#a58bc0", "#ca7f91", "#6ba5ac", "#b39668"];
function color(sku: string) { let hash = 0; for (const c of sku) hash = c.charCodeAt(0) + ((hash << 5) - hash); return colors[Math.abs(hash) % colors.length]; }
function tint(hex: string, amount: number) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${Math.max(0, Math.min(255, (n >> 16) + amount))} ${Math.max(0, Math.min(255, ((n >> 8) & 255) + amount))} ${Math.max(0, Math.min(255, (n & 255) + amount))})`;
}

export default function Aisle3DView({ shelves, plans, selectedShelfId, onSelect }: Props) {
  const [yaw, setYaw] = useState(24);
  const [elevation, setElevation] = useState(.27);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; mode: "rotate" | "pan"; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const model = useMemo(() => {
    const gap = 1.5;
    const starts: number[] = [];
    let totalWidth = 0;
    for (const shelf of shelves) { starts.push(totalWidth); totalWidth += shelf.width + gap; }
    totalWidth = Math.max(1, totalWidth - gap);
    const maxHeight = Math.max(1, ...shelves.map(shelf => shelf.height));
    const maxDepth = Math.max(1, ...shelves.map(shelf => shelf.depth));
    const angle = yaw * Math.PI / 180, cosine = Math.cos(angle), sine = Math.sin(angle);
    const projectedWidth = totalWidth * Math.abs(cosine) + maxDepth * Math.abs(sine);
    const projectedHeight = maxHeight + (totalWidth * Math.abs(sine) + maxDepth * Math.abs(cosine)) * elevation;
    const scale = Math.min((W - 120) / projectedWidth, (H - 100) / projectedHeight) * zoom;
    const raw = (x: number, y: number, z: number): Point => {
      const dx = x - totalWidth / 2, dz = z - maxDepth / 2;
      const u = dx * cosine + dz * sine;
      const v = dz * cosine - dx * sine;
      return { x: u * scale, y: -y * scale + v * scale * elevation };
    };
    const bounds = shelves.flatMap((shelf, index) => {
      const x = starts[index];
      return [[x, 0, 0], [x + shelf.width, shelf.height, shelf.depth]] as [number, number, number][];
    }).map(([x, y, z]) => raw(x, y, z));
    const minX = Math.min(...bounds.map(point => point.x)), maxX = Math.max(...bounds.map(point => point.x));
    const minY = Math.min(...bounds.map(point => point.y)), maxY = Math.max(...bounds.map(point => point.y));
    const offsetX = W / 2 - (minX + maxX) / 2;
    const offsetY = H / 2 - (minY + maxY) / 2;
    const project = (x: number, y: number, z: number): Point => { const point = raw(x, y, z); return { x: point.x + offsetX + pan.x, y: point.y + offsetY + pan.y }; };
    const poly = (...coords: number[]) => Array.from({ length: coords.length / 3 }, (_, i) => { const point = project(coords[i * 3], coords[i * 3 + 1], coords[i * 3 + 2]); return `${point.x.toFixed(1)},${point.y.toFixed(1)}`; }).join(" ");
    return { starts, gap, totalWidth, maxHeight, maxDepth, scale, project, poly };
  }, [shelves, yaw, elevation, zoom, pan]);
  const { starts, totalWidth, maxHeight, project, poly, scale } = model;
  const activePlan = (shelfId: string) => plans.filter(plan => plan.shelf.id === shelfId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const levelPositions = (shelf: ShelfRecord) => { let y = 0; return shelf.levelHeights.map(clear => { const levelY = y; y += clear; return levelY; }); };
  const board = (shelf: ShelfRecord) => Math.max(.6, Math.min(1.1, shelf.height * .012));
  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, mode: event.shiftKey || event.altKey ? "pan" : "rotate", moved: false };
    suppressClick.current = false;
  }
  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!drag.current) return;
    const dx = event.clientX - drag.current.x, dy = event.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true;
    if (drag.current.mode === "pan") setPan(current => ({ x: current.x + dx * 1.2, y: current.y + dy * 1.2 }));
    else { setYaw(current => (current + dx * .55 + 360) % 360); setElevation(current => Math.max(.12, Math.min(.72, current - dy * .0018))); }
    drag.current.x = event.clientX; drag.current.y = event.clientY;
  }
  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>) {
    suppressClick.current = Boolean(drag.current?.moved);
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function resetView() { setYaw(24); setElevation(.27); setZoom(1); setPan({ x: 0, y: 0 }); }

  return <div className="aisle-3d-shell">
    <div className="aisle-3d-heading"><div><strong>Full aisle · interactive 3D</strong><span>Drag to rotate · Shift + drag to move · Scroll or use controls to zoom</span></div><div className="aisle-3d-heading-right"><div className="aisle-3d-legend"><i className="selected-dot"/> Selected door <i className="layout-dot"/> Has a planogram</div><div className="aisle-view-controls"><button aria-label="Zoom out" title="Zoom out" onClick={() => setZoom(value => Math.max(.55, value - .15))}><ZoomOut size={13}/></button><span>{Math.round(zoom * 100)}%</span><button aria-label="Zoom in" title="Zoom in" onClick={() => setZoom(value => Math.min(2.5, value + .15))}><ZoomIn size={13}/></button><button aria-label="Reset 3D view" title="Reset view" onClick={resetView}><RotateCcw size={13}/></button></div></div></div>
    <div className="aisle-3d-canvas"><svg className="aisle-3d-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Interactive 3D view of an aisle with ${shelves.length} doors`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onClickCapture={event => { if (suppressClick.current) { event.stopPropagation(); suppressClick.current = false; } }} onWheel={event => { event.preventDefault(); setZoom(value => Math.max(.55, Math.min(2.5, value * (event.deltaY < 0 ? 1.08 : .92)))); }}>
      <ellipse cx={W / 2} cy={H - 33} rx={Math.min(430, Math.max(115, totalWidth * scale * .52))} ry="17" fill="#26354b" opacity=".07"/>
      {shelves.map((shelf, index) => {
        const start = starts[index], end = start + shelf.width, depth = shelf.depth, height = shelf.height;
        const plan = activePlan(shelf.id);
        const selected = selectedShelfId === shelf.id;
        const levels = levelPositions(shelf);
        return <g key={shelf.id} className="aisle-door-model" role="button" tabIndex={0} aria-label={`${shelf.name}${plan ? `, current planogram ${plan.name}` : ", no saved planogram"}`} aria-pressed={selected} onClick={() => { if (!suppressClick.current) onSelect(shelf.id); }} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(shelf.id); } }}>
          <polygon points={poly(start,0,0, end,0,0, end,height,0, start,height,0)} fill={selected ? "#f2f5ff" : "#f7f8fa"} stroke="#d5dae2" strokeWidth="1.2"/>
          <polygon points={poly(start,0,0, start,0,depth, start,height,depth, start,height,0)} fill="#e0e4ea" stroke="#c6ccd5" strokeWidth="1"/>
          <polygon points={poly(end,0,0, end,0,depth, end,height,depth, end,height,0)} fill="#c8cfd8" stroke="#b5bec9" strokeWidth="1"/>
          <polygon points={poly(start,height,0, end,height,0, end,height,depth, start,height,depth)} fill="#e4e8ed" stroke="#c2c9d3" strokeWidth="1"/>
          {levels.map((y, levelIndex) => <g key={`${shelf.id}-level-${levelIndex}`}>
            <polygon points={poly(start,y,0, end,y,0, end,y,depth, start,y,depth)} fill="#cbd1da" stroke="#aeb7c3" strokeWidth=".8"/>
            <polygon points={poly(start,y-board(shelf),depth, end,y-board(shelf),depth, end,y,depth, start,y,depth)} fill="#aeb7c3" stroke="#9ca7b5" strokeWidth=".6"/>
          </g>)}
          {plan?.placements.map((items, levelIndex) => {
            let cursor = 0;
            const baseY = levels[levelIndex] ?? 0;
            return items.map(item => {
              const x = start + cursor;
              const width = item.product.width * item.facings;
              cursor += width;
              const productDepth = Math.min(depth, item.product.depth);
              const back = depth - productDepth;
              const productHeight = Math.min(item.product.height, shelf.levelHeights[levelIndex] ?? item.product.height);
              const base = color(item.product.sku);
              return <g key={`${shelf.id}-${levelIndex}-${item.productId}`} className="aisle-mini-product">
                <polygon points={poly(x,baseY+productHeight,back, x+width,baseY+productHeight,back, x+width,baseY+productHeight,depth, x,baseY+productHeight,depth)} fill={tint(base,33)} stroke={tint(base,-22)} strokeWidth=".5"/>
                <polygon points={poly(x+width,baseY,back, x+width,baseY,depth, x+width,baseY+productHeight,depth, x+width,baseY+productHeight,back)} fill={tint(base,-32)} stroke={tint(base,-45)} strokeWidth=".5"/>
                <polygon points={poly(x,baseY,depth, x+width,baseY,depth, x+width,baseY+productHeight,depth, x,baseY+productHeight,depth)} fill={base} stroke={tint(base,-40)} strokeWidth=".7"/>
              </g>;
            });
          })}
          <polygon className={`aisle-door-hit ${selected ? "active" : ""}`} points={poly(start,0,depth, end,0,depth, end,height,depth, start,height,depth)} fill="transparent" stroke={selected ? "#5c73bf" : "#bfc6d1"} strokeWidth={selected ? 2.6 : 1.2}/>
          {(() => { const point = project(start + shelf.width / 2, -4.5, depth * .45); return <text className="aisle-door-label" x={point.x} y={point.y} textAnchor="middle">{shelf.name}</text>; })()}
          {(() => { const point = project(start + shelf.width / 2, -8, depth * .45); return <text className={`aisle-plan-label ${plan ? "has-plan" : ""}`} x={point.x} y={point.y} textAnchor="middle">{plan ? "CURRENT PLANOGRAM" : "NO SAVED PLANOGRAM"}</text>; })()}
        </g>;
      })}
      {(() => { const point = project(totalWidth / 2, 0, 0); return <text x={point.x} y={H - 14} textAnchor="middle" className="aisle-floor-label">{shelves.length} DOORS · {Math.round(totalWidth)}″ TOTAL WIDTH · {maxHeight}″ MAX HEIGHT</text>; })()}
    </svg><div className="aisle-pan-hint"><Move3D size={11}/> Hold Shift while dragging to pan</div></div>
    <div className="aisle-door-strip">{shelves.map(shelf => { const plan = activePlan(shelf.id); const selected = selectedShelfId === shelf.id; return <button className={`aisle-door-choice ${selected ? "active" : ""}`} key={shelf.id} aria-pressed={selected} onClick={() => onSelect(shelf.id)}><span className="aisle-choice-indicator"/><span><strong>{shelf.name}</strong><small>{plan?.name ?? "No saved planogram"}</small></span><small className="aisle-choice-size">{shelf.width}″ × {shelf.height}″</small></button>; })}</div>
  </div>;
}
