"use client";

import { useMemo, useRef, useState } from "react";
import { RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import type { PlacementPreference } from "./planogram-optimizer";
import type { ShelfRecord } from "./shelf-configuration";

type ShelfDimensions = Pick<ShelfRecord, "name" | "width" | "height" | "depth" | "levelHeights">;
type Props = { shelf: ShelfDimensions; placements?: PlacementPreference[][]; compact?: boolean; interactive?: boolean; selectedProductId?: string; onSelectProduct?: (productId: string) => void };
type Point = { x: number; y: number };

const VIEW_W = 960;
const VIEW_H = 560;
const palette = ["#d9b157", "#dc806f", "#79ab91", "#7593ca", "#a58bc0", "#ca7f91", "#6ba5ac", "#b39668"];
function productColor(sku: string) { let hash = 0; for (const c of sku) hash = c.charCodeAt(0) + ((hash << 5) - hash); return palette[Math.abs(hash) % palette.length]; }
function shade(hex: string, amount: number) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  return `rgb(${r} ${g} ${b})`;
}

export default function Shelf3DView({ shelf, placements = [], compact = false, interactive = false, selectedProductId, onSelectProduct }: Props) {
  const [yaw, setYaw] = useState(28);
  const [zoom, setZoom] = useState(1);
  const pointer = useRef<{ startX: number; lastX: number; moved: boolean; productId: string } | null>(null);
  const view = useMemo(() => {
    const W = Math.max(1, shelf.width), H = Math.max(1, shelf.height), D = Math.max(1, shelf.depth);
    const angle = yaw * Math.PI / 180;
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    const projectedWidth = W * Math.abs(cosine) + D * Math.abs(sine);
    const projectedHeight = H + (W * Math.abs(sine) + D * Math.abs(cosine)) * 0.32;
    const scale = Math.min((VIEW_W - 160) / projectedWidth, (VIEW_H - (compact ? 105 : 130)) / projectedHeight) * zoom;
    const project = (x: number, y: number, z: number): Point => {
      const dx = x - W / 2, dz = z - D / 2;
      const u = dx * cosine + dz * sine;
      const v = dz * cosine - dx * sine;
      return { x: VIEW_W / 2 + u * scale, y: VIEW_H / 2 - y * scale + v * scale * 0.32 };
    };
    const poly = (...coords: number[]) => Array.from({ length: coords.length / 3 }, (_, i) => { const p = project(coords[i * 3], coords[i * 3 + 1], coords[i * 3 + 2]); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(" ");
    const levels: { y: number; height: number }[] = [];
    let accumulated = 0;
    for (const clear of shelf.levelHeights) { levels.push({ y: accumulated, height: clear }); accumulated += clear; }
    const board = Math.max(0.6, Math.min(1.2, H * 0.012));
    return { W, H, D, scale, project, poly, levels, board };
  }, [shelf.width, shelf.height, shelf.depth, shelf.levelHeights, compact, yaw, zoom]);
  const { W, H, D, project, poly, levels, board, scale } = view;
  const label = (text: string, x: number, y: number, z: number, size: number, fill = "#737b88", weight = 500) => {
    const p = project(x, y, z);
    return <text x={p.x} y={p.y} textAnchor="middle" fontSize={size} fill={fill} fontWeight={weight}>{text}</text>;
  };

  return <div className={`shelf-3d-wrap ${compact ? "compact" : ""}`}>
    {!compact && <div className="shelf-3d-toolbar"><div><strong>Interactive 3D shelf</strong><span>{interactive ? "Drag to rotate · Select a product to edit" : "Drag to rotate · Dimensions and product depth shown to scale"}</span></div><span className="shelf-3d-depth-label">{W}″ W <i/> {H}″ H <i/> {D}″ D</span><div className="shelf-3d-rotate"><button aria-label="Rotate view left" title="Rotate view left" onClick={() => setYaw(value => (value - 12 + 360) % 360)}><RotateCcw size={12}/></button><button aria-label="Rotate view right" title="Rotate view right" onClick={() => setYaw(value => (value + 12) % 360)}><RotateCw size={12}/></button><button aria-label="Zoom out shelf" title="Zoom out" onClick={() => setZoom(value => Math.max(.65, value - .12))}><ZoomOut size={12}/></button><button aria-label="Zoom in shelf" title="Zoom in" onClick={() => setZoom(value => Math.min(1.8, value + .12))}><ZoomIn size={12}/></button><button aria-label="Reset shelf view" title="Reset view" onClick={() => { setYaw(28); setZoom(1); }}><RotateCcw size={12}/></button></div></div>}
    <svg className={`shelf-3d-svg ${interactive ? "interactive" : ""}`} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={`${shelf.name}, isometric 3D view, ${W} inches wide, ${H} inches tall, ${D} inches deep`} onPointerDown={interactive ? event => { const target = event.target instanceof Element ? event.target.closest<SVGGElement>("[data-product-id]") : null; pointer.current = { startX: event.clientX, lastX: event.clientX, moved: false, productId: target?.dataset.productId ?? "" }; event.currentTarget.setPointerCapture(event.pointerId); } : undefined} onPointerMove={interactive ? event => { const current = pointer.current; if (!current) return; const dx = event.clientX - current.lastX; if (Math.abs(event.clientX - current.startX) > 3) current.moved = true; if (current.moved) setYaw(value => (value + dx * .45 + 360) % 360); current.lastX = event.clientX; } : undefined} onPointerUp={interactive ? event => { const current = pointer.current; if (current && !current.moved && current.productId) onSelectProduct?.(current.productId); pointer.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } : undefined} onPointerCancel={interactive ? () => { pointer.current = null; } : undefined} onWheel={interactive ? event => { event.preventDefault(); setZoom(value => Math.max(.65, Math.min(1.8, value * (event.deltaY < 0 ? 1.08 : .92)))); } : undefined}>
      <defs><linearGradient id="shelf-back" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#fafbfc"/><stop offset="1" stopColor="#edf0f4"/></linearGradient></defs>
      <ellipse cx="480" cy="512" rx={Math.max(100, (W * scale + D * scale * 0.6) / 2)} ry="12" fill="#26354b" opacity=".07"/>
      {/* Back panel and side uprights establish the actual fixture depth. */}
      <polygon points={poly(0,0,0, W,0,0, W,H,0, 0,H,0)} fill="url(#shelf-back)" stroke="#c9cfd8" strokeWidth="1.5"/>
      <polygon points={poly(0,0,0, 0,0,D, 0,H,D, 0,H,0)} fill="#dfe3e9" stroke="#c1c8d2" strokeWidth="1"/>
      <polygon points={poly(W,0,0, W,0,D, W,H,D, W,H,0)} fill="#c4cbd5" stroke="#afb8c5" strokeWidth="1"/>
      <polygon points={poly(0,H,0, W,H,0, W,H,D, 0,H,D)} fill="#e3e7ec" stroke="#bdc5d0" strokeWidth="1"/>
      {levels.map((level, i) => <g key={`board-${i}`}>
        <polygon points={poly(0,level.y,0, W,level.y,0, W,level.y,D, 0,level.y,D)} fill="#cbd1da" stroke="#aeb7c3" strokeWidth="1"/>
        <polygon points={poly(0,level.y-board, D, W,level.y-board,D, W,level.y,D, 0,level.y,D)} fill="#aeb7c3" stroke="#9ca7b5" strokeWidth=".8"/>
        {label(`LEVEL ${i + 1}`, -2, level.y + Math.min(level.height * 0.55, 5), D * 0.25, 8, "#828b99", 700)}
      </g>)}
      {placements.map((entries, levelIndex) => {
        let cursor = 0;
        const y = levels[levelIndex]?.y ?? 0;
        return entries.map(item => {
          const x = item.x ?? cursor;
          const width = item.product.width * item.facings;
          cursor = x + width;
          const depth = Math.min(D, item.product.depth);
          const back = D - depth;
          const height = Math.min(levels[levelIndex]?.height ?? item.product.height, item.product.height);
          const base = productColor(item.product.sku);
          const top: [number, number, number][] = [[x,y+height,back], [x+width,y+height,back], [x+width,y+height,D], [x,y+height,D]];
          const right: [number, number, number][] = [[x+width,y,back], [x+width,y,D], [x+width,y+height,D], [x+width,y+height,back]];
          const front: [number, number, number][] = [[x,y,D], [x+width,y,D], [x+width,y+height,D], [x,y+height,D]];
          const center = project(x+width/2, y+height*.58, D);
          const fontSize = Math.max(7, Math.min(13, width * scale * .095));
          const selected = selectedProductId === item.productId;
          const selectProps = interactive ? { role: "button" as const, tabIndex: 0, "aria-label": `${item.product.name}, Level ${levelIndex + 1}, ${item.facings} facings`, "aria-pressed": selected, onClick: () => onSelectProduct?.(item.productId), onKeyDown: (event: React.KeyboardEvent<SVGGElement>) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectProduct?.(item.productId); } } } : {};
          return <g key={`${levelIndex}-${item.productId}`} data-product-id={interactive ? item.productId : undefined} className={`shelf-3d-product ${interactive ? "selectable" : ""} ${selected ? "selected" : ""}`} {...selectProps}>
            <polygon points={poly(...top.flat())} fill={shade(base, 34)} stroke={selected ? "#344f9a" : shade(base, -22)} strokeWidth={selected ? "3" : "1"}/>
            <polygon points={poly(...right.flat())} fill={shade(base, -34)} stroke={selected ? "#344f9a" : shade(base, -48)} strokeWidth={selected ? "3" : "1"}/>
            <polygon points={poly(...front.flat())} fill={base} stroke={selected ? "#344f9a" : shade(base, -40)} strokeWidth={selected ? "3" : "1.1"}/>
            {width * scale > 37 && <text x={center.x} y={center.y} textAnchor="middle" fontSize={fontSize} fontWeight="650" fill="#fff" paintOrder="stroke" stroke="#27334455" strokeWidth="1.3">{item.product.name.length > 20 ? `${item.product.name.slice(0, 18)}…` : item.product.name}</text>}
            {width * scale > 34 && <text x={center.x} y={center.y + fontSize + 2} textAnchor="middle" fontSize={Math.max(6, fontSize * .75)} fill="#fff" opacity=".9">{item.facings} fac · {item.product.depth}″ deep</text>}
          </g>;
        });
      })}
      <line x1="94" y1="516" x2="146" y2="516" stroke="#9ba3b0" strokeWidth="1"/>
      {!compact && <text x="120" y="535" textAnchor="middle" fontSize="9" fill="#9098a5">FRONT</text>}
      {!compact && <text x="480" y="544" textAnchor="middle" fontSize="9" fill="#7e8795">{W}″ wide · {H}″ high · {D}″ deep</text>}
    </svg>
    {!compact && <div className="shelf-3d-footnote">Product boxes use package dimensions and facings. {interactive ? "Select a product to adjust it below." : ""}</div>}
  </div>;
}
