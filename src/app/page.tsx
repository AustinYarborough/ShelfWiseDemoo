"use client";

import { useEffect, useState } from "react";
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, Box, ChevronDown, ChevronRight, CircleHelp, Command, Grid2X2, LayoutDashboard, Menu, MoreHorizontal, Plus, Search, Settings2, ShoppingBag, Sparkles, Store, X } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import ProductCatalog from "./product-catalog";
import ShelfConfiguration from "./shelf-configuration";
import PlanogramBuilder from "./planogram-builder";
import SalesDataSetup from "./sales-data-setup";
import WorkspaceSettings from "./workspace-settings";

const nav = [
  { label: "WORKSPACE", items: [{ name: "Dashboard", icon: LayoutDashboard }, { name: "Product catalog", icon: Box }, { name: "Sales data", icon: Activity }, { name: "Store setup", icon: Store }, { name: "Planogram builder", icon: Grid2X2 }] },
];
const activity = [
  { initials: "AM", color: "violet", text: <><b>Alex Morgan</b> created a planogram</>, detail: "Snacks · Aisle 04", time: "12 min ago" },
  { initials: "JL", color: "green", text: <><b>Jordan Lee</b> updated shelf dimensions</>, detail: "Beverages · Store 018", time: "1 hr ago" },
  { initials: "AM", color: "blue", text: <><b>Alex Morgan</b> imported product catalog</>, detail: "248 products added", time: "Yesterday" },
  { initials: "SK", color: "orange", text: <><b>Sam Kim</b> saved a planogram</>, detail: "Breakfast · Aisle 02", time: "Yesterday" },
];
const plans = [
  { name: "Summer snacks refresh", aisle: "Snacks · Aisle 04", products: 18, updated: "Today, 10:42 AM", status: "Published", tone: "green", colors: ["#f7c04a", "#dc7350", "#8ebc83", "#e8a0a0", "#89a7d8", "#d5bb81"] },
  { name: "Beverage endcap v2", aisle: "Beverages · Store 018", products: 12, updated: "Yesterday", status: "Draft", tone: "gray", colors: ["#82a6e3", "#d99569", "#9abf9c", "#edc96c", "#bc9ad4", "#80bac0"] },
  { name: "Breakfast essentials", aisle: "Grocery · Aisle 02", products: 24, updated: "Oct 1, 2026", status: "Published", tone: "green", colors: ["#d9ad62", "#92ba86", "#d58167", "#e7c953", "#a4a9d6", "#d896a2"] },
];
const chartData = [{ day: "Sep 27", value: 32 }, { day: "Sep 28", value: 42 }, { day: "Sep 29", value: 37 }, { day: "Sep 30", value: 56 }, { day: "Oct 1", value: 49 }, { day: "Oct 2", value: 68 }, { day: "Oct 3", value: 62 }];

export default function Dashboard() {
  const [active, setActive] = useState("Dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileName, setProfileName] = useState("Alex Morgan");
  const [companyName, setCompanyName] = useState("Northstar Retail");
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("shelfwise.workspace-profile.v1");
      if (saved) {
        const parsed = JSON.parse(saved) as { userName?: unknown; companyName?: unknown };
        if (typeof parsed.userName === "string" && parsed.userName.trim()) setProfileName(parsed.userName);
        if (typeof parsed.companyName === "string" && parsed.companyName.trim()) setCompanyName(parsed.companyName);
      }
    } catch { /* Ignore invalid or unavailable browser storage and use demo defaults. */ }
    setProfileLoaded(true);
  }, []);

  useEffect(() => {
    if (profileLoaded) localStorage.setItem("shelfwise.workspace-profile.v1", JSON.stringify({ userName: profileName, companyName }));
  }, [profileLoaded, profileName, companyName]);

  const choose = (name: string) => { setActive(name); setMobileOpen(false); };
  const toast = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2800); };

  return <div className="app-shell">
    {mobileOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark"><span /><span /><span /><span /></div><span className="brand-name">shelfwise</span><button className="workspace-switch"><span className="workspace-avatar">{getInitials(companyName)}</span><span className="workspace-copy"><strong>{companyName}</strong><small>Free workspace</small></span><ChevronDown size={14} /></button></div>
      <div className="sidebar-search" onClick={() => setSearchOpen(true)} role="button" tabIndex={0}><Search size={15} /><span>Search anything...</span><kbd>⌘ K</kbd></div>
      <nav className="main-nav">{nav.map(group => <div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(item => <button key={item.name} className={`nav-item ${active === item.name ? "active" : ""}`} onClick={() => choose(item.name)}><item.icon size={17} strokeWidth={1.8} /><span>{item.name}</span>{item.name === "Planogram builder" && <span className="nav-new">NEW</span>}</button>)}</div>)}</nav>
      <div className="sidebar-spacer" /><div className="sidebar-bottom"><button className={`nav-item ${active === "Settings" ? "active" : ""}`} onClick={() => choose("Settings")}><Settings2 size={17} /><span>Settings</span></button><button className="nav-item" onClick={() => toast("Help center is coming soon.")}><CircleHelp size={17} /><span>Help & support</span><ArrowUpRight size={13} className="external" /></button><div className="profile"><div className="profile-avatar">{getInitials(profileName)}</div><div className="profile-copy"><strong>{profileName}</strong><small>Store administrator</small></div><MoreHorizontal size={18} /></div></div>
    </aside>
    <main className="main-area"><header className="topbar"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={19} /></button><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{active}</strong></div><div className="topbar-actions"><span className="date-label">Friday, October 3, 2026</span><span className="top-divider"/><button className="icon-button notification" aria-label="Notifications" onClick={() => toast("You’re all caught up.")}><Bell size={18} /><i /></button><div className="top-avatar">{getInitials(profileName)}</div></div></header>
      {active === "Product catalog" ? <ProductCatalog /> : active === "Sales data" ? <SalesDataSetup companyName={companyName} /> : active === "Store setup" ? <ShelfConfiguration onOpenPlanogramBuilder={() => choose("Planogram builder")} /> : active === "Planogram builder" ? <PlanogramBuilder onManageStore={() => choose("Store setup")} /> : active === "Settings" ? <WorkspaceSettings userName={profileName} companyName={companyName} onSave={(name, company) => { setProfileName(name); setCompanyName(company); }} /> : active === "Dashboard" ? <div className="content"><div className="page-heading"><div><div className="eyebrow">OVERVIEW</div><h1>Good morning, {profileName.trim().split(/\s+/)[0]} <span>✳</span></h1><p>Here’s what’s happening across your merchandising workspace.</p></div><button className="primary-button" onClick={() => choose("Planogram builder")}><Plus size={17} /> Create planogram</button></div>
        <section className="metrics-grid" aria-label="Workspace metrics"><Metric icon={<Box size={17}/>} label="Total products" value="1,284" delta="12.8%" note="vs. last month" positive/><Metric icon={<Grid2X2 size={17}/>} label="Saved planograms" value="36" delta="8.3%" note="vs. last month" positive/><Metric icon={<Store size={17}/>} label="Shelves configured" value="18" delta="2 this week" note=""/><Metric icon={<Activity size={17}/>} label="Avg. shelf utilization" value="84.6%" delta="4.2%" note="vs. last month" positive/></section>
        <section className="overview-grid"><div className="card performance-card"><div className="card-header"><div><h2>Planogram activity</h2><p>Layouts created over the last 7 days</p></div><button className="select-button" onClick={() => toast("Showing the last 7 days.")}>Last 7 days <ChevronDown size={14}/></button></div><div className="chart-summary"><strong>24</strong><span className="trend"><ArrowUpRight size={14}/> 18.2%</span><small>planograms created</small></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 8, right: 5, left: -26, bottom: 0 }}><defs><linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4d73e6" stopOpacity={0.16}/><stop offset="95%" stopColor="#4d73e6" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#eff0f2" strokeDasharray="3 5"/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#969ba4", fontSize: 11 }} dy={10}/><Tooltip contentStyle={{ borderRadius: 9, border: "1px solid #e9eaed", boxShadow: "0 4px 14px #17213b12", fontSize: 12 }} formatter={(v) => [`${v} layouts`, "Activity"]}/><Area type="monotone" dataKey="value" stroke="#4f70dc" strokeWidth={2.2} fill="url(#activityFill)" dot={false} activeDot={{ r: 4, fill: "#4f70dc", stroke: "white", strokeWidth: 2 }}/></AreaChart></ResponsiveContainer></div></div>
        <div className="card activity-card"><div className="card-header"><div><h2>Recent activity</h2><p>Latest updates from your team</p></div><button className="icon-button subtle" aria-label="More activity options" onClick={() => toast("Activity options are coming soon.")}><MoreHorizontal size={19}/></button></div><div className="activity-list">{activity.map((item, i) => <div className="activity-item" key={i}><div className={`activity-avatar ${item.color}`}>{item.initials}</div><div className="activity-copy"><div>{item.text}</div><small>{item.detail}</small></div><time>{item.time}</time></div>)}</div><button className="text-link" onClick={() => toast("You’re viewing the latest activity.")}>View all activity <ArrowRight size={14}/></button></div></section>
        <section className="card plans-card"><div className="card-header plans-heading"><div><h2>Recent planograms</h2><p>Your team’s latest shelf layouts</p></div><button className="text-link" onClick={() => choose("Store setup")}>Manage in store setup <ArrowRight size={14}/></button></div><div className="table-scroll"><table><thead><tr><th>PLANOGRAM</th><th>PRODUCTS</th><th>LAST UPDATED</th><th>STATUS</th><th></th></tr></thead><tbody>{plans.map((plan, i) => <tr key={plan.name}><td><div className="plan-cell"><div className="plan-thumb">{plan.colors.map((color, j) => <span key={j} style={{ background: color }}/>)}</div><div><strong>{plan.name}</strong><small>{plan.aisle}</small></div></div></td><td>{plan.products} products</td><td>{plan.updated}</td><td><span className={`status ${plan.tone}`}><i/>{plan.status}</span></td><td><button className="row-more" aria-label={`Options for ${plan.name}`} onClick={() => toast(`${plan.name} options are coming soon.`)}><MoreHorizontal size={18}/></button></td></tr>)}</tbody></table></div></section>
        <footer className="page-footer"><span>© 2026 Shelfwise</span><span>Made for better shelves <span className="footer-heart">♥</span></span><button onClick={() => toast("Help center is coming soon.")}>Help center <ArrowUpRight size={12}/></button></footer>
      </div> : <ComingSoon name={active} onBack={() => choose("Dashboard")} onCreate={() => choose("Planogram builder")} />}
    </main>
    {notice && <div className="toast"><span className="toast-check">✓</span>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={14}/></button></div>}
    {searchOpen && <div className="modal-backdrop" onClick={() => setSearchOpen(false)}><div className="search-modal" onClick={e => e.stopPropagation()}><div className="search-modal-input"><Search size={18}/><input autoFocus placeholder="Search pages..." onChange={() => {}}/><kbd>ESC</kbd></div>{["Dashboard", "Product catalog", "Sales data", "Store setup", "Planogram builder", "Settings"].map(item => <button key={item} onClick={() => { choose(item); setSearchOpen(false); }}><span><Command size={15}/>{item}</span><ArrowRight size={14}/></button>)}</div></div>}
  </div>;
}

function getInitials(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join("") || "U";
}

function Metric({ icon, label, value, delta, note, positive = false }: { icon: React.ReactNode; label: string; value: string; delta: string; note: string; positive?: boolean }) {
  return <div className="card metric-card"><div className="metric-top"><span className="metric-icon">{icon}</span><button className="metric-menu" aria-label={`${label} details`}><MoreHorizontal size={17}/></button></div><div className="metric-label">{label}</div><div className="metric-bottom"><strong>{value}</strong><span className={positive ? "metric-change positive" : "metric-change neutral"}>{positive ? <ArrowUpRight size={13}/> : null}{delta}</span></div>{note && <div className="metric-note">{note}</div>}</div>;
}

function ComingSoon({ name, onBack, onCreate }: { name: string; onBack: () => void; onCreate: () => void }) {
  const detail: Record<string, string> = { "Product catalog": "Add, search, and organize the products your team merchandises.", "Store setup": "Manage store locations, aisles, and shelf or cooler door dimensions.", "Planogram builder": "Choose a location, aisle, shelf door, and products to build a layout.", "Saved planograms": "Reopen, edit, and export your team’s shelf layouts.", Settings: "Manage your workspace profile and preferences." };
  const isBuilder = name === "Planogram builder";
  return <div className="coming-wrap"><div className="coming-icon">{isBuilder ? <Sparkles size={22}/> : <ShoppingBag size={22}/>}</div><div className="eyebrow">{isBuilder ? "PLANOGRAM WORKFLOW" : "WORKSPACE"}</div><h1>{name}</h1><p>{detail[name] || "This workspace section is part of the upcoming MVP stages."}</p><span className="coming-badge"><span/>Stage {name === "Product catalog" ? "2" : name === "Store setup" ? "3" : isBuilder ? "4–5" : "6"} · Coming next</span><div className="coming-actions"><button className="primary-button" onClick={onBack}>Back to dashboard</button>{isBuilder && <button className="secondary-button" onClick={onCreate}>Explore workflow</button>}</div></div>;
}
