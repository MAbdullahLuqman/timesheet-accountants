"use client";

import { useMemo, useState } from "react";
import { createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type SortingState } from "@tanstack/react-table";
import { AlertTriangle, ArrowDown, ArrowUp, Check, CheckCheck, Clock3, MessageSquareText, Search, Send, ShieldCheck, TrendingDown, Users, Wallet } from "lucide-react";
import { Avatar, Badge, Button, Drawer, PageHeading, SectionTitle } from "@/components/ui";
import { useAppState } from "@/lib/app-state";
import { departments, findClient, findStaff, formatPKR, staff, type TimeEntry } from "@/lib/mock-data";

type ReviewRow = { entry: TimeEntry; name: string; initials: string; department: string; client: string; engagement: string; code: string; hours: number; status: string; budget: number; risk: number };
const col = createColumnHelper<ReviewRow>();
const entryHours = (entry: TimeEntry) => entry.hours.reduce((sum, value) => sum + Number(value || 0), 0);

export default function ApprovalsPage() {
  const { role, timeEntries, setTimeEntries, engagementList, auditThreads, setAuditThreads } = useAppState();
  const isPartner = role.role === "Managing Partner";
  const department = role.department;
  const [selectedDepartment, setSelectedDepartment] = useState<string>(isPartner ? "All departments" : department);
  const [activeRow, setActiveRow] = useState<ReviewRow | null>(null);
  const [query, setQuery] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "risk", desc: true }]);
  const visibleEntries = timeEntries.filter((entry) => {
    const item = engagementList.find((engagement) => engagement.id === entry.engagementId)!;
    return (isPartner ? selectedDepartment === "All departments" || item.department === selectedDepartment : item.department === department) && (["Submitted", "Returned"].includes(entry.status));
  });
  const rows: ReviewRow[] = visibleEntries.map((entry) => {
    const person = findStaff(entry.staffId);
    const engagement = engagementList.find((item) => item.id === entry.engagementId)!;
    const status = entry.status;
    const budget = engagement.loggedHours / engagement.budgetHours * 100;
    return { entry, name: person.name, initials: person.initials, department: person.department, client: findClient(engagement.clientId).name, engagement: engagement.name, code: entry.taskCode, hours: entryHours(entry), status, budget, risk: status === "Returned" ? 3 : budget >= 85 ? 2 : 1 };
  }).filter((row) => `${row.name} ${row.client} ${row.engagement} ${row.code}`.toLowerCase().includes(query.toLowerCase()));
  const pendingHours = visibleEntries.reduce((sum, entry) => sum + entryHours(entry), 0);
  const scopeStaff = staff.filter((person) => person.role !== "Managing Partner" && (isPartner ? selectedDepartment === "All departments" || person.department === selectedDepartment : person.department === department));
  const stripStaff = isPartner && selectedDepartment === "All departments" ? departments.flatMap((dept) => {
    const group = scopeStaff.filter((person) => person.department === dept);
    return [group.find((person) => person.role === "Department Head"), group.find((person) => person.status === "Overtime"), group.find((person) => person.status === "Exam leave")].filter((person) => person !== undefined);
  }) : scopeStaff;
  const utilization = scopeStaff.length ? scopeStaff.reduce((sum, person) => sum + person.hours, 0) / scopeStaff.reduce((sum, person) => sum + person.weeklyCapacity, 0) * 100 : 0;
  const atRisk = engagementList.filter((item) => (isPartner ? selectedDepartment === "All departments" || item.department === selectedDepartment : item.department === department) && item.loggedHours / item.budgetHours > 0.85);
  const wip = timeEntries.filter((entry) => {
    const engagement = engagementList.find((item) => item.id === entry.engagementId);
    const inScope = engagement && (isPartner ? selectedDepartment === "All departments" || engagement.department === selectedDepartment : engagement.department === department);
    return entry.status !== "Draft" && Boolean(inScope);
  }).reduce((sum, entry) => {
    const person = findStaff(entry.staffId);
    return sum + (entry.approvedHours ?? entryHours(entry)) * person.billingRate;
  }, 0);

  const approveEntry = (row: ReviewRow) => setTimeEntries((current) => current.map((entry) => entry.id === row.entry.id ? { ...entry, status: "Approved", approvedHours: entry.approvedHours ?? entryHours(entry) } : entry));
  const columns = useMemo(() => [
    col.accessor("risk", { id: "risk", header: "Priority", cell: ({ row }) => row.original.status === "Returned" ? <span className="inline-flex size-5 items-center justify-center rounded-full bg-amber-100 text-amber-800" title="Returned item"><AlertTriangle size={12} /></span> : row.original.budget >= 85 ? <span className="inline-flex size-5 items-center justify-center rounded-full bg-rose-100 text-rose-800" title="Engagement above 85% budget"><TrendingDown size={12} /></span> : <span className="size-5" /> }),
    col.display({ id: "staff", header: "Staff member", cell: ({ row }) => <div className="flex items-center gap-2"><Avatar name={row.original.name} size="sm" /><div><p className="text-[10px] font-medium text-zinc-800">{row.original.name}</p><p className="text-[9px] text-zinc-500">{row.original.department}</p></div></div> }),
    col.accessor("client", { header: "Client / engagement", cell: ({ row }) => <div className="max-w-[260px]"><p className="truncate text-[10px] font-medium text-zinc-800">{row.original.client}</p><p className="mt-0.5 truncate text-[9px] text-zinc-500">{row.original.engagement}</p><p className="mt-1 text-[9px] text-zinc-400">{row.original.code}</p></div> }),
    col.accessor("hours", { header: "Logged", cell: ({ getValue }) => <span className="tabular-nums text-[11px] font-semibold">{getValue().toFixed(2)}h</span> }),
    col.display({ id: "approved", header: "Approved / billed", cell: ({ row }) => {
      const current = row.original.entry.approvedHours ?? row.original.hours;
      const variance = row.original.hours - current;
      return <div className="flex items-center gap-2"><input aria-label={`Approved hours for ${row.original.name}`} type="number" min="0" max={row.original.hours} step="0.25" value={current} onChange={(event) => setTimeEntries((items) => items.map((entry) => entry.id === row.original.entry.id ? { ...entry, approvedHours: Math.min(row.original.hours, Math.max(0, Math.round(Number(event.target.value) * 4) / 4)) } : entry))} className="h-8 w-[72px] rounded border border-zinc-200 px-2 text-right text-[11px] tabular-nums focus:border-emerald-600" /><span className="text-[9px] text-zinc-400">h</span><Badge tone={variance > 0 ? "amber" : "green"}>{variance > 0 ? `−${variance.toFixed(2)}h` : "No variance"}</Badge></div>;
    } }),
    col.display({ id: "action", header: "Review", cell: ({ row }) => <div className="flex items-center justify-end gap-1.5"><Button variant="secondary" className="h-7 px-2 text-[10px]" onClick={() => approveEntry(row.original)} disabled={row.original.status === "Approved"}><Check size={12} /> Approve</Button><Button variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => { setActiveRow(row.original); setDraftQuery(""); }}><MessageSquareText size={12} /> Return / query</Button></div> }),
  ], [setTimeEntries]);
  const table = useReactTable({ data: rows, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });
  const sendQuery = () => {
    if (!activeRow || !draftQuery.trim()) return;
    setAuditThreads((current) => ({ ...current, [activeRow.entry.id]: [...(current[activeRow.entry.id] ?? []), { author: role.name, time: "Just now", message: draftQuery.trim() }] }));
    setTimeEntries((current) => current.map((entry) => entry.id === activeRow.entry.id ? { ...entry, status: "Returned", comment: draftQuery.trim() } : entry));
    setActiveRow(null);
    setDraftQuery("");
  };

  if (!isPartner && role.role !== "Department Head") return <div className="mx-auto mt-16 max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center"><div className="mx-auto grid size-10 place-items-center rounded-full bg-zinc-100 text-zinc-600"><ShieldCheck size={18} /></div><h1 className="mt-4 text-base font-semibold">Department head access required</h1><p className="mt-2 text-xs leading-5 text-zinc-500">Approvals are available to department heads and the Managing Partner.</p></div>;

  return <>
    <PageHeading title={isPartner ? "Firm approvals" : "My team approvals"} subtitle={isPartner ? "Review submitted time across the firm; choose a department or view them all." : `Only ${department} department entries appear here. Review submitted time and send queries to your team.`} actions={<label className="flex h-9 items-center gap-2 rounded-md border border-zinc-200 bg-white px-2.5 text-[10px] text-zinc-500"><span>Department</span><select aria-label="Department scope" disabled={!isPartner} value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value)} className="max-w-[126px] border-0 bg-transparent py-0 pr-5 text-[10px] font-medium text-zinc-800 outline-none disabled:opacity-100"><option>All departments</option>{departments.map((item) => <option key={item}>{item}</option>)}</select></label>} />
    <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Metric icon={<Users size={15} />} label="Team utilization" value={`${utilization.toFixed(1)}%`} detail={`${scopeStaff.length} staff in scope`} tone="zinc" />
      <Metric icon={<Clock3 size={15} />} label="Pending approval" value={`${pendingHours.toFixed(1)}h`} detail={`${visibleEntries.length} entries to review`} tone="amber" />
      <Metric icon={<Wallet size={15} />} label="Unbilled WIP" value={formatPKR(wip)} detail="At current client billing rates" tone="zinc" />
      <Metric icon={<AlertTriangle size={15} />} label="At-risk engagements" value={`${atRisk.length}`} detail="Above 85% of hour budget" tone={atRisk.length ? "rose" : "green"} />
    </div>
    <section className="mb-5 rounded-lg border border-zinc-200 bg-white p-4"><SectionTitle title="Departmental staff status" detail={isPartner && selectedDepartment === "All departments" ? "15 representatives across five departments · select a department to see its full team" : `${stripStaff.length} team members · week ending Sat, Nov 21`} action={<Badge tone="neutral">{isPartner ? selectedDepartment : department}</Badge>} />
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{stripStaff.map((person) => <div key={person.id} className="flex min-w-[174px] items-center gap-2 rounded-md border border-zinc-100 bg-zinc-50/70 px-2.5 py-2"><Avatar name={person.name} size="sm" /><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-medium">{person.name}</p><p className="truncate text-[9px] text-zinc-500">{person.role === "Department Head" ? "Department head" : person.department}</p></div><div className="text-right"><Badge tone={person.status === "Draft" ? "neutral" : person.status === "Exam leave" ? "blue" : person.status === "Overtime" ? "rose" : "green"}>{person.status}</Badge><p className="mt-1 text-[9px] tabular-nums text-zinc-500">{person.hours}h</p></div></div>)}</div>
    </section>
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3"><div><h2 className="text-[12px] font-semibold">Exception-first review queue</h2><p className="mt-0.5 text-[10px] text-zinc-500">Returned items and engagements nearing budget appear first.</p></div><label className="flex h-8 items-center gap-2 rounded-md border border-zinc-200 px-2 text-zinc-400"><Search size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search approvals" placeholder="Find staff or client" className="w-36 border-0 bg-transparent text-[10px] text-zinc-700 outline-none placeholder:text-zinc-400" /></label></div>
      <div className="table-scroll"><table className="w-full min-w-[980px] border-collapse text-left"><thead className="bg-zinc-50">{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id} className="border-b border-zinc-200 px-3 py-2.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-zinc-500"><button disabled={!header.column.getCanSort()} onClick={header.column.getToggleSortingHandler()} className="inline-flex items-center gap-1 disabled:cursor-default">{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}{header.column.getIsSorted() === "asc" ? <ArrowUp size={11} /> : header.column.getIsSorted() === "desc" ? <ArrowDown size={11} /> : null}</button></th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map((row) => <tr key={row.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60">{row.getVisibleCells().map((cell) => <td key={cell.id} className="px-3 py-2.5 align-middle">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}{!rows.length && <tr><td colSpan={6} className="py-12 text-center"><CheckCheck className="mx-auto text-emerald-700" size={20} /><p className="mt-2 text-xs font-medium">No entries need review</p><p className="mt-1 text-[10px] text-zinc-500">Try another department or clear your search.</p></td></tr>}</tbody></table></div>
      <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-2.5 text-[9px] text-zinc-500"><span>{rows.length} entries · scope updates with the active role</span><span className="tabular-nums">Pending {pendingHours.toFixed(2)} h</span></div>
    </section>
    <Drawer open={!!activeRow} onOpenChange={(open) => !open && setActiveRow(null)} title="Return or query entry" description={activeRow ? `${activeRow.name} · ${activeRow.client} · ${activeRow.hours.toFixed(2)}h logged` : undefined}>
      {activeRow && <div className="flex min-h-[calc(100dvh-68px)] flex-col"><div className="flex-1 space-y-4 p-5"><div className="rounded-md border border-zinc-200 bg-zinc-50 p-3"><p className="text-[10px] font-semibold text-zinc-700">Entry context</p><p className="mt-1 text-[10px] text-zinc-600">{activeRow.engagement} <span className="text-zinc-400">·</span> {activeRow.code}</p><p className="mt-2 text-[10px] text-zinc-500">Week of Nov 16 · Logged {activeRow.hours.toFixed(2)}h · {activeRow.budget.toFixed(0)}% budget used</p></div><div><h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Audit trail</h3><div className="space-y-4">{(auditThreads[activeRow.entry.id] ?? []).map((message, index) => <div key={index} className="flex gap-2.5"><Avatar name={message.author} size="sm" /><div className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-1"><p className="text-[10px] font-medium">{message.author}</p><span className="text-[9px] text-zinc-400">{message.time}</span></div><p className="mt-2 text-[11px] leading-5 text-zinc-600">{message.message}</p></div></div>)}</div></div></div><div className="border-t border-zinc-200 p-4"><label className="block text-[10px] font-medium text-zinc-700">Send query to accountant<textarea value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} rows={3} placeholder="Ask for context, supporting details, or a time correction…" className="mt-1.5 w-full resize-y rounded-md border border-zinc-200 px-3 py-2 text-[11px] leading-5 placeholder:text-zinc-400" /></label><div className="mt-3 flex items-center justify-between gap-2"><p className="text-[9px] text-zinc-400">Sending returns this entry to the accountant.</p><Button variant="primary" onClick={sendQuery} disabled={!draftQuery.trim()}><Send size={13} /> Send & return</Button></div></div></div>}
    </Drawer>
  </>;
}

function Metric({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: "zinc" | "amber" | "rose" | "green" }) {
  const color = { zinc: "text-zinc-500", amber: "text-amber-700", rose: "text-rose-700", green: "text-emerald-700" }[tone];
  return <section className="rounded-lg border border-zinc-200 bg-white p-3.5"><div className="flex items-center justify-between"><span className="text-[10px] font-medium text-zinc-500">{label}</span><span className={color}>{icon}</span></div><p className="mt-2 text-[20px] font-semibold tracking-[-0.04em] tabular-nums">{value}</p><p className="mt-1 text-[9px] text-zinc-500">{detail}</p></section>;
}
