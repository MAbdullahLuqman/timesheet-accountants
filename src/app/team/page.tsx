"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search, Users } from "lucide-react";
import { createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type SortingState } from "@tanstack/react-table";
import { Avatar, Badge, Button, PageHeading } from "@/components/ui";
import { useAppState } from "@/lib/app-state";
import { departments, formatPKR, staff, type StaffMember } from "@/lib/mock-data";

const column = createColumnHelper<StaffMember>();

export default function TeamPage() {
  const { role } = useAppState();
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All departments");
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);
  const isPartner = role.role === "Managing Partner";
  const allowed = isPartner || role.role === "Department Head";
  const people = useMemo(() => staff.filter((person) => person.role !== "Managing Partner" && (isPartner ? departmentFilter === "All departments" || person.department === departmentFilter : person.department === role.department) && `${person.name} ${person.role} ${person.department}`.toLowerCase().includes(search.toLowerCase())), [search, departmentFilter, isPartner, role.department]);
  const columns = useMemo(() => [
    column.accessor("name", { header: "Team member", cell: ({ row, getValue }) => <div className="flex items-center gap-2.5"><Avatar name={getValue()} /><div><p className="text-[10px] font-medium text-zinc-800">{getValue()}</p><p className="mt-0.5 text-[9px] text-zinc-500">{row.original.id}</p></div></div> }),
    column.accessor("role", { header: "Role", cell: ({ getValue }) => <span className="text-[10px] text-zinc-700">{getValue()}</span> }),
    column.accessor("department", { header: "Department", cell: ({ getValue }) => <Badge>{getValue()}</Badge> }),
    column.accessor("costRate", { header: "Internal cost / hour", cell: ({ getValue }) => <span className="tabular-nums">{formatPKR(getValue())}</span> }),
    column.accessor("billingRate", { header: "Client billing / hour", cell: ({ getValue }) => <span className="tabular-nums font-medium">{formatPKR(getValue())}</span> }),
    column.accessor("weeklyCapacity", { header: "Weekly capacity", cell: ({ getValue }) => <span className="tabular-nums">{getValue()}h</span> }),
    column.accessor("status", { header: "This week", cell: ({ row, getValue }) => <div className="flex items-center justify-between gap-2"><Badge tone={getValue() === "Submitted" ? "green" : getValue() === "Overtime" ? "rose" : getValue() === "Exam leave" ? "blue" : "neutral"}>{getValue()}</Badge><span className="text-[9px] tabular-nums text-zinc-500">{row.original.hours.toFixed(1)}h</span></div> }),
  ], []);
  const table = useReactTable({ data: people, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });
  if (!allowed) return <div className="mx-auto mt-16 max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center"><div className="mx-auto grid size-10 place-items-center rounded-full bg-zinc-100 text-zinc-600"><Users size={18} /></div><h1 className="mt-4 text-base font-semibold">Department head access required</h1><p className="mt-2 text-xs leading-5 text-zinc-500">The team directory is available to department heads and the Managing Partner.</p></div>;

  return <>
    <PageHeading title={isPartner ? "Firm team directory" : `My ${role.department} team`} subtitle={isPartner ? "Staff assignments and rates across all departments. Choose a department to narrow the list." : `Only staff assigned to ${role.department} are shown. Rates and capacity are read-only.`} actions={<><label className="flex h-9 items-center gap-2 rounded-md border border-zinc-200 bg-white px-2.5 text-zinc-400"><Search size={13} /><input aria-label="Search team members" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search staff" className="w-32 border-0 bg-transparent text-[10px] text-zinc-700 outline-none placeholder:text-zinc-400" /></label><label className="flex h-9 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-[10px] text-zinc-500"><span>Dept</span><select aria-label="Team department" disabled={!isPartner} value={isPartner ? departmentFilter : role.department} onChange={(event) => setDepartmentFilter(event.target.value)} className="max-w-[120px] border-0 bg-transparent py-0 pr-5 text-[10px] font-medium text-zinc-700 outline-none disabled:opacity-100"><option>All departments</option>{departments.map((item) => <option key={item}>{item}</option>)}</select></label></>} />
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2.5"><div className="flex items-center gap-2"><Users size={14} className="text-zinc-500" /><p className="text-[10px] font-medium">{people.length} people in scope</p><span className="text-[9px] text-zinc-400">· Hourly rates are illustrative and shown in PKR</span></div><Badge tone="neutral">Rates view · Read only</Badge></div>
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white"><div className="table-scroll"><table className="w-full min-w-[920px] border-collapse text-left"><thead className="bg-zinc-50">{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id} className="border-b border-zinc-200 px-3 py-2.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-zinc-500"><button className="inline-flex items-center gap-1" onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}{header.column.getIsSorted() === "asc" ? <ArrowUp size={10} /> : header.column.getIsSorted() === "desc" ? <ArrowDown size={10} /> : null}</button></th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map((row) => <tr key={row.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60">{row.getVisibleCells().map((cell) => <td key={cell.id} className="px-3 py-2.5">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}{!people.length && <tr><td colSpan={7} className="py-10 text-center text-xs text-zinc-500">No team members match that search.</td></tr>}</tbody></table></div></section>
    <p className="mt-3 text-[9px] text-zinc-500">Managing Partner sees all 60 staff members. Department heads see their assigned team only.</p>
  </>;
}
