"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Activity, BarChart3, BriefcaseBusiness, CalendarDays, ChevronLeft, ChevronRight, FileClock, Menu, Pause, Play, ShieldCheck, Users } from "lucide-react";
import { AppStateProvider, useAppState } from "@/lib/app-state";
import { clients, roles } from "@/lib/mock-data";
import { cn } from "@/lib/cn";
import { Drawer } from "@/components/ui";

const nav = [
  { href: "/timesheet", label: "My timesheet", icon: CalendarDays, groups: ["staff", "head", "partner"] },
  { href: "/approvals", label: "Approvals", icon: ShieldCheck, groups: ["head", "partner"] },
  { href: "/engagements", label: "Engagements", icon: BriefcaseBusiness, groups: ["staff", "head", "partner"] },
  { href: "/reports", label: "Profitability", icon: BarChart3, groups: ["partner"] },
  { href: "/team", label: "Team directory", icon: Users, groups: ["head", "partner"] },
];

function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const state = useAppState();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const roleGroup = state.role.role === "Managing Partner" ? "partner" : state.role.role === "Department Head" ? "head" : "staff";
  const scopeDescription = roleGroup === "partner" ? "Firm-wide · all departments" : roleGroup === "head" ? `${state.role.department} · your team only` : `${state.role.department} · your own time`;
  const visibleNav = nav.filter((item) => item.groups.includes(roleGroup)).map((item) => ({
    ...item,
    label: item.href === "/approvals" ? (roleGroup === "partner" ? "Firm approvals" : "My team approvals")
      : item.href === "/engagements" ? (roleGroup === "partner" ? "All engagements" : "Department engagements")
      : item.href === "/team" ? (roleGroup === "partner" ? "All staff" : "My team")
      : item.href === "/reports" ? "Firm profitability" : item.label,
  }));
  const pendingCount = state.timeEntries.filter((entry) => (entry.status === "Submitted" || entry.status === "Returned") && (roleGroup === "partner" || state.engagementList.find((item) => item.id === entry.engagementId)?.department === state.role.department)).length;
  const hours = String(Math.floor(state.timerSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((state.timerSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(state.timerSeconds % 60).padStart(2, "0");
  const end = new Date(state.weekStart.getTime() + 5 * 86400000);
  const weekLabel = `${state.weekStart.toLocaleDateString("en-PK", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-PK", { month: "short", day: "numeric", year: "numeric" })}`;

  return <div className="app-frame flex">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-xs focus:shadow-lg">Skip to main content</a>
    <aside className={cn("sidebar sticky top-0 hidden h-screen flex-col border-r border-zinc-200 bg-white transition-[width] duration-200 md:flex", collapsed && "!w-[68px] !basis-[68px]")}>
      <div className={cn("flex h-14 items-center gap-3 border-b border-zinc-100 px-4", collapsed && "justify-center px-2")}>
        <div className="grid size-8 shrink-0 place-items-center rounded-md bg-zinc-900 text-white"><Activity size={16} strokeWidth={2.2} /></div>
        {!collapsed && <div className="brand-copy min-w-0"><p className="truncate text-[12px] font-semibold tracking-[-0.02em]">Practice Workbench</p><p className="mt-0.5 text-[10px] text-zinc-500">Islamabad · Demo workspace</p></div>}
        {!collapsed && <button onClick={() => setCollapsed(true)} aria-label="Collapse sidebar" className="ml-auto rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"><ChevronLeft size={15} /></button>}
        {collapsed && <button onClick={() => setCollapsed(false)} aria-label="Expand sidebar" className="absolute right-[-12px] top-[70px] z-10 grid size-6 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm"><ChevronRight size={13} /></button>}
      </div>
      <div className={cn("px-3 pt-4", collapsed && "px-2")}>
        {!collapsed && <p className="sidebar-section-label mb-2 px-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-zinc-400">Workspace</p>}
        {!collapsed && <p className="mb-3 px-2 text-[10px] leading-4 text-zinc-500">{scopeDescription}</p>}
        <nav aria-label="Workspace navigation" className="space-y-1">{visibleNav.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined} aria-current={active ? "page" : undefined} className={cn("flex h-9 items-center gap-3 rounded-md px-2.5 text-[12px] font-medium transition-colors", collapsed && "justify-center px-0", active ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800")}><Icon size={16} strokeWidth={1.8} />{!collapsed && <span className="sidebar-label">{item.label}</span>}{!collapsed && item.href === "/approvals" && <span className="ml-auto rounded-full bg-amber-100 px-1.5 text-[9px] font-semibold text-amber-800">{pendingCount}</span>}</Link>;
        })}</nav>
      </div>
      <div className="mt-auto border-t border-zinc-100 p-3">
        {!collapsed && <div className="mb-3 rounded-md border border-zinc-200 bg-zinc-50 p-3"><div className="flex items-center gap-2"><div className="grid size-6 place-items-center rounded bg-white text-zinc-500"><FileClock size={13} /></div><p className="text-[10px] font-medium text-zinc-700">Week closes Saturday</p></div><p className="mt-2 text-[10px] leading-4 text-zinc-500">Submit your time by 6:00 PM to keep billing on schedule.</p></div>}
        {!collapsed && <div className="mt-2 flex items-center gap-2 border-t border-zinc-100 px-1 pt-3"><div className="grid size-7 place-items-center rounded-full bg-zinc-100 text-[9px] font-semibold text-zinc-600">{state.role.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-medium">{state.role.name}</p><p className="text-[9px] text-zinc-500">{state.role.title}</p></div></div>}
      </div>
    </aside>
    <div className="workspace min-w-0">
      <header className="topbar sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-zinc-200 bg-white/95 px-4 backdrop-blur-sm sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <button className="mr-1 grid size-8 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 md:hidden" onClick={() => setMobileMenu(true)} aria-label="Open navigation"><Menu size={17} /></button>
          <div className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1"><span className={cn("size-1.5 shrink-0 rounded-full", state.timerRunning ? "animate-pulse bg-emerald-500" : "bg-zinc-300")} /><select className="max-w-[122px] truncate border-0 bg-transparent p-0 pr-5 text-[10px] font-medium text-zinc-700 outline-none" aria-label="Timer client" value={state.timerClient} onChange={(event) => state.setTimerClient(event.target.value)}>{clients.slice(0, 6).map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select><span className="tabular-nums text-[10px] font-semibold text-zinc-900">{hours}:{minutes}:{seconds}</span><button onClick={state.toggleTimer} aria-label={state.timerRunning ? "Pause timer" : "Start timer"} className="ml-1 grid size-6 shrink-0 place-items-center rounded text-zinc-500 hover:bg-zinc-100">{state.timerRunning ? <Pause size={13} /> : <Play size={13} />}</button><button onClick={state.stopTimer} disabled={state.timerSeconds === 0} title="Stop and log to timesheet" className="rounded px-1.5 py-1 text-[9px] font-medium text-emerald-800 hover:bg-emerald-50 disabled:text-zinc-300">Stop & log</button></div>
          {state.timerLog && <span className="hidden whitespace-nowrap text-[9px] text-emerald-700 sm:inline">+{state.timerLog.hours.toFixed(2)}h logged</span>}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-md border border-zinc-200 p-0.5"><button aria-label="Previous week" onClick={() => state.shiftWeek(-1)} className="grid size-6 place-items-center rounded text-zinc-500 hover:bg-zinc-100"><ChevronLeft size={14} /></button><span className="min-w-[148px] text-center text-[10px] font-medium tabular-nums">{weekLabel}</span><button aria-label="Next week" onClick={() => state.shiftWeek(1)} className="grid size-6 place-items-center rounded text-zinc-500 hover:bg-zinc-100"><ChevronRight size={14} /></button></div>
          <label className="flex h-8 max-w-[170px] items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 text-[10px] font-medium text-zinc-700"><span className="hidden text-zinc-400 lg:inline">Viewing as</span><select aria-label="Switch role" value={state.role.id} onChange={(event) => state.setRole(event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent p-0 pr-5 text-[10px] font-medium outline-none">{roles.map((role) => <option key={role.id} value={role.id}>{role.name} — {role.title}</option>)}</select></label>
          <div className="hidden size-8 place-items-center rounded-full border border-zinc-200 bg-zinc-100 text-[9px] font-semibold text-zinc-600 sm:grid">{state.role.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
        </div>
      </header>
      <main id="main-content" className="page-width px-6 py-6">{children}</main>
    </div>
    <Drawer open={mobileMenu} onOpenChange={setMobileMenu} title="Workspace navigation" description="Choose an area to work in." className="!left-0 !right-auto !w-[280px] !border-l-0 !border-r md:hidden">
      <div className="border-b border-zinc-100 px-5 py-3"><p className="text-[10px] font-medium text-zinc-800">{state.role.title}</p><p className="mt-0.5 text-[10px] text-zinc-500">{scopeDescription}</p></div>
      <nav aria-label="Mobile navigation" className="space-y-1 p-4">{visibleNav.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} onClick={() => setMobileMenu(false)} className={cn("flex h-10 items-center gap-3 rounded-md px-3 text-xs", pathname === item.href ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-600 hover:bg-zinc-50")}><Icon size={16} />{item.label}</Link>; })}</nav>
    </Drawer>
  </div>;
}

export function AppShell({ children }: { children: ReactNode }) {
  return <AppStateProvider><AppFrame>{children}</AppFrame></AppStateProvider>;
}
