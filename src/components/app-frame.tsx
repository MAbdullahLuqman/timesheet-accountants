"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, BarChart3, BriefcaseBusiness, CalendarDays, ChevronLeft, ChevronRight, FileClock, ReceiptText, ClipboardList, LogOut, Menu, Pause, Play, ShieldCheck, Users } from "lucide-react";
import { useAppState } from "@/lib/portal-state";
import { createClient } from "@/lib/supabase/client";
import { logTimerEntry } from "@/lib/supabase/actions";
import { cn } from "@/lib/cn";
import { Badge, Button, Drawer } from "@/components/ui";

const nav = [
  { href: "/accountant/timesheet", label: "Timesheet", icon: CalendarDays, roles: ["STAFF", "HEAD"] },
  { href: "/accountant/leaves", label: "Leaves", icon: ClipboardList, roles: ["STAFF", "HEAD"] },
  { href: "/accountant/expenses", label: "Travelling & Expenses", icon: ReceiptText, roles: ["STAFF", "HEAD"] },
  { href: "/accountant/engagements", label: "Client engagements", icon: BriefcaseBusiness, roles: ["STAFF", "HEAD"] },
  { href: "/partner/review", label: "End-of-week review", icon: ShieldCheck, roles: ["PARTNER"] },
  { href: "/partner/leaves", label: "Leave Requests", icon: ClipboardList, roles: ["PARTNER"] },
  { href: "/partner/expenses", label: "Travelling & Expenses", icon: ReceiptText, roles: ["PARTNER"] },
  { href: "/partner/users", label: "User & access control", icon: Users, roles: ["PARTNER"] },
  { href: "/partner/engagements", label: "Clients & engagements", icon: BriefcaseBusiness, roles: ["PARTNER"] },
  { href: "/partner/reports", label: "Firm analytics & export", icon: BarChart3, roles: ["PARTNER"] },
];
const dateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function AppFrame({ children, pendingCounts = {} }: { children: ReactNode; pendingCounts?: Record<string, number> }) {
  const pathname = usePathname();
  const state = useAppState();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingTimer, setPendingTimer] = useState<ReturnType<typeof state.stopTimer>>(null);
  const visibleNav = nav.filter((item) => item.roles.includes(state.profile.role));
  const end = new Date(state.weekStart.getFullYear(), state.weekStart.getMonth(), state.weekStart.getDate() + 5);
  const weekLabel = `${state.weekStart.toLocaleDateString("en-PK", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-PK", { month: "short", day: "numeric", year: "numeric" })}`;
  const hours = String(Math.floor(state.timerSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((state.timerSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(state.timerSeconds % 60).padStart(2, "0");
  const initials = state.profile.full_name.split(" ").map((part) => part[0]).slice(0, 2).join("");

  const stopAndLog = async () => {
    const timer = pendingTimer ?? state.stopTimer();
    if (!timer) return;
    setPendingTimer(timer);
    const result = await logTimerEntry(timer);
    setMessage("error" in result ? result.error : `Logged ${timer.loggedHours.toFixed(2)}h to the selected day.`);
    if (!("error" in result)) { state.clearTimer(); setPendingTimer(null); router.refresh(); }
  };
  const signOut = async () => {
    await createClient().auth.signOut();
    queryClient.clear();
    router.replace("/login");
    router.refresh();
  };

  return <div className="app-frame flex">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-xs focus:shadow-lg">Skip to main content</a>
    <aside className={cn("sidebar sticky top-0 hidden h-screen flex-col border-r border-zinc-200 bg-white transition-[width] duration-200 md:flex", collapsed && "!w-[68px] !basis-[68px]")}>
      <div className={cn("flex h-14 items-center gap-3 border-b border-zinc-100 px-4", collapsed && "justify-center px-2")}>
        <div className="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--accent)] text-white"><Activity size={16} /></div>
        {!collapsed && <div className="min-w-0"><p className="truncate text-[12px] font-semibold">{state.profile.firm.name}</p><p className="mt-0.5 text-[10px] text-zinc-500">Practice Workbench</p></div>}
        {!collapsed && <button onClick={() => setCollapsed(true)} aria-label="Collapse sidebar" className="ml-auto rounded p-1 text-zinc-400 hover:bg-zinc-100"><ChevronLeft size={15} /></button>}
        {collapsed && <button onClick={() => setCollapsed(false)} aria-label="Expand sidebar" className="absolute right-[-12px] top-[70px] z-10 grid size-6 place-items-center rounded-full border border-zinc-200 bg-white shadow-sm"><ChevronRight size={13} /></button>}
      </div>
      <div className={cn("px-3 pt-4", collapsed && "px-2")}>
        {!collapsed && <><p className="mb-2 px-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-zinc-400">Workspace</p><p className="mb-3 px-2 text-[10px] leading-4 text-zinc-500">{state.profile.role === "PARTNER" ? "Firm-wide · all departments" : `${state.profile.department?.name ?? "No department"} · ${state.profile.role === "HEAD" ? "department team" : "your own time"}`}</p></>}
        <nav aria-label="Workspace navigation" className="space-y-1">{visibleNav.map((item) => { const Icon = item.icon; const active = pathname === item.href; return <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined} aria-current={active ? "page" : undefined} className={cn("flex h-9 items-center gap-3 rounded-md px-2.5 text-[12px] font-medium", collapsed && "justify-center px-0", active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-zinc-600 hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]")}><Icon size={16} />{collapsed && !!pendingCounts[item.href] && <span aria-label={`${pendingCounts[item.href]} pending`} className="absolute ml-7 -mt-5 rounded-full bg-amber-100 px-1 text-[9px] font-semibold text-amber-900">{pendingCounts[item.href]}</span>}{!collapsed && <span>{item.label}</span>}{!collapsed && !!pendingCounts[item.href] && <span aria-label={`${pendingCounts[item.href]} pending`} className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">{pendingCounts[item.href]}</span>}</Link>; })}</nav>
      </div>
      <div className="mt-auto border-t border-zinc-100 p-3">
        {!collapsed && <div className="mb-3 rounded-md border border-zinc-200 bg-zinc-50 p-3"><div className="flex items-center gap-2"><FileClock size={13} className="text-zinc-500" /><p className="text-[10px] font-medium">Week closes Saturday</p></div><p className="mt-2 text-[10px] leading-4 text-zinc-500">Submit your time by 6:00 PM to keep billing on schedule.</p></div>}
        {!collapsed && <div className="flex items-center gap-2 border-t border-zinc-100 px-1 pt-3"><div className="grid size-7 place-items-center rounded-full bg-zinc-100 text-[9px] font-semibold">{initials}</div><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-medium">{state.profile.full_name}</p><p className="text-[9px] text-zinc-500">{state.profile.department?.name ?? "Firm-wide"} · {state.profile.role}</p></div></div>}
      </div>
    </aside>
    <div className="workspace min-w-0">
      <header className="topbar sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-zinc-200 bg-white/95 px-4 backdrop-blur-sm sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <button className="mr-1 grid size-8 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 md:hidden" onClick={() => setMobileMenu(true)} aria-label="Open navigation"><Menu size={17} /></button>
          {state.profile.role !== "PARTNER" && <div className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1"><span className={cn("size-1.5 rounded-full", state.timerRunning ? "animate-pulse bg-emerald-500" : "bg-zinc-300")} /><select disabled={!state.activeEngagements.length || !!pendingTimer || state.timerRunning} className="max-w-[140px] border-0 bg-transparent p-0 pr-5 text-[10px] font-medium" aria-label="Timer engagement" value={state.timerEngagement} onChange={(event) => state.setTimerEngagement(event.target.value)}>{state.activeEngagements.map((engagement) => <option key={engagement.id} value={engagement.id}>{engagement.client_name} · {engagement.title}</option>)}</select><select disabled={!!pendingTimer || state.timerRunning} className="hidden max-w-[125px] border-0 bg-transparent p-0 pr-4 text-[9px] md:block" aria-label="Timer task code" value={state.timerTaskCode} onChange={(event) => state.setTimerTaskCode(event.target.value)}>{["FBR Income Tax / IRIS", "Sales Tax / SRB / PRA", "WHT Reconciliation", "Statutory Audit", "SECP Filing", "Bookkeeping", "Exam Leave / Admin"].map((code) => <option key={code}>{code}</option>)}</select><span className="tabular-nums text-[10px] font-semibold">{hours}:{minutes}:{seconds}</span><button onClick={state.toggleTimer} disabled={!state.activeEngagements.length || !!pendingTimer} aria-label={state.timerRunning ? "Pause timer" : "Start timer"} className="grid size-6 place-items-center rounded text-zinc-500 hover:bg-zinc-100">{state.timerRunning ? <Pause size={13} /> : <Play size={13} />}</button><button onClick={stopAndLog} disabled={!state.timerSeconds} className="rounded px-1.5 py-1 text-[9px] font-medium text-emerald-800 hover:bg-emerald-50 disabled:text-zinc-300">{pendingTimer ? "Retry log" : "Stop & log"}</button></div>}
          {message && <span aria-live="polite" className="hidden max-w-[190px] truncate text-[9px] text-emerald-700 sm:inline">{message}</span>}
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-md border border-zinc-200 p-0.5"><button aria-label="Previous week" onClick={() => state.shiftWeek(-1)} className="grid size-6 place-items-center rounded text-zinc-500 hover:bg-zinc-100"><ChevronLeft size={14} /></button><span className="min-w-[148px] text-center text-[10px] font-medium tabular-nums">{weekLabel}</span><button aria-label="Next week" onClick={() => state.shiftWeek(1)} className="grid size-6 place-items-center rounded text-zinc-500 hover:bg-zinc-100"><ChevronRight size={14} /></button></div>
          <div className="hidden items-center gap-2 sm:flex"><div className="text-right"><p className="max-w-[150px] truncate text-[10px] font-medium">{state.profile.full_name}</p><p className="text-[9px] text-zinc-500">{state.profile.role}{state.profile.department ? ` · ${state.profile.department.name}` : ""}</p></div><Badge tone={state.profile.role === "PARTNER" ? "blue" : state.profile.role === "HEAD" ? "green" : "neutral"}>{state.profile.role}</Badge></div>
          <Button variant="ghost" className="size-8 px-2" onClick={signOut} aria-label="Sign out"><LogOut size={15} /><span className="hidden lg:inline">Sign out</span></Button>
        </div>
      </header>
      <main id="main-content" className="page-width px-6 py-6">{children}</main>
    </div>
    <Drawer open={mobileMenu} onOpenChange={setMobileMenu} title="Workspace navigation" description="Choose an area to work in." className="!left-0 !right-auto !w-[280px] !border-l-0 !border-r md:hidden">
      <div className="border-b border-zinc-100 px-5 py-3"><p className="text-[10px] font-medium">{state.profile.full_name} · {state.profile.role}</p><p className="mt-0.5 text-[10px] text-zinc-500">{state.profile.department?.name ?? "Firm-wide"}</p></div>
      <nav aria-label="Mobile navigation" className="space-y-1 p-4">{visibleNav.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} onClick={() => setMobileMenu(false)} className={cn("flex h-10 items-center gap-3 rounded-md px-3 text-xs", pathname === item.href ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]" : "text-zinc-600 hover:bg-[var(--accent-soft)]")}><Icon size={16} />{item.label}{!!pendingCounts[item.href] && <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">{pendingCounts[item.href]}</span>}</Link>; })}</nav>
    </Drawer>
  </div>;
}
