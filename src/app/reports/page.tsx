"use client";

import { useMemo, useState } from "react";
import { ArrowDownToLine, ArrowDown, ArrowUp, BarChart3, CircleDollarSign, Percent } from "lucide-react";
import { createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type SortingState } from "@tanstack/react-table";
import { Badge, Button, PageHeading } from "@/components/ui";
import { useAppState } from "@/lib/app-state";
import { departmentPerformance, departments, findClient, findStaff, formatPKR, staff, type Department } from "@/lib/mock-data";
type MarginRow = { client: string; department: Department; contractFee: number; internalCost: number; margin: number };
const col = createColumnHelper<MarginRow>();
const csvField = (value: string) => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
};

export default function ReportsPage() {
  const { role, timeEntries, engagementList } = useAppState();
  const [sorting, setSorting] = useState<SortingState>([{ id: "margin", desc: true }]);
  const [exportStatus, setExportStatus] = useState("");
  const marginRows = useMemo(() => {
    const byClient = new Map<string, { fee: number; cost: number; department: Department }>();
    engagementList.forEach((engagement) => {
      const item = byClient.get(engagement.clientId) ?? { fee: 0, cost: 0, department: engagement.department };
      const team = staff.filter((person) => person.department === engagement.department);
      const deptCost = team.reduce((sum, person) => sum + person.costRate, 0) / team.length;
      item.fee += engagement.contractValue;
      item.cost += engagement.loggedHours * deptCost;
      byClient.set(engagement.clientId, item);
    });
    return [...byClient.entries()].map(([clientId, item]) => ({ client: findClient(clientId).name, department: item.department, contractFee: item.fee, internalCost: item.cost, margin: item.fee ? (item.fee - item.cost) / item.fee * 100 : 0 }));
  }, [engagementList]);
  const columns = useMemo(() => [
    col.accessor("client", { header: "Client", cell: ({ getValue }) => <span className="text-[10px] font-medium">{getValue()}</span> }),
    col.accessor("department", { header: "Lead department", cell: ({ getValue }) => <Badge>{getValue()}</Badge> }),
    col.accessor("contractFee", { header: "Contract fee (PKR)", cell: ({ getValue }) => <span className="tabular-nums">{formatPKR(getValue())}</span> }),
    col.accessor("internalCost", { header: "Internal staff cost (PKR)", cell: ({ getValue }) => <span className="tabular-nums text-zinc-600">{formatPKR(getValue())}</span> }),
    col.accessor("margin", { header: "Net margin", cell: ({ getValue }) => <Badge tone={getValue() >= 65 ? "green" : getValue() >= 45 ? "amber" : "rose"}>{getValue().toFixed(1)}%</Badge> }),
  ], []);
  const table = useReactTable({ data: marginRows, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });
  const exportCsv = () => {
    const approved = timeEntries.filter((entry) => entry.status === "Approved");
    const header = ["Entry ID", "Week of", "Staff member", "Department", "Client", "Engagement", "Task code", "Logged hours", "Approved hours", "Billing rate (PKR)"];
    const lines = approved.map((entry) => {
      const engagement = engagementList.find((item) => item.id === entry.engagementId)!;
      const person = findStaff(entry.staffId);
      return [entry.id, entry.weekOf, person.name, String(person.department), findClient(engagement.clientId).name, engagement.name, entry.taskCode, entry.hours.reduce((sum, hours) => sum + hours, 0).toFixed(2), (entry.approvedHours ?? 0).toFixed(2), String(person.billingRate)].map(csvField).join(",");
    });
    const blob = new Blob([`\uFEFF${[header.map(csvField).join(","), ...lines].join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "approved-billing-nov-16-2026.csv";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setExportStatus(`${approved.length} approved entries exported.`);
  };
  if (role.role !== "Managing Partner") return <PermissionNotice />;
  const totalBilled = Object.values(departmentPerformance).reduce((sum, item) => sum + item.billed, 0);
  const averageRealization = Object.values(departmentPerformance).reduce((sum, item) => sum + item.realization, 0) / departments.length;
  const averageUtilization = Object.values(departmentPerformance).reduce((sum, item) => sum + item.utilization, 0) / departments.length;

  return <>
    <PageHeading title="Partner profitability" subtitle="Realization, capacity, and client margin across the Islamabad practice." actions={<Button variant="primary" onClick={exportCsv}><ArrowDownToLine size={14} /> Export billing CSV</Button>} />
    <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3"><Summary icon={<Percent size={15} />} title="Average realization" value={`${averageRealization.toFixed(1)}%`} help="Across five departments" /><Summary icon={<BarChart3 size={15} />} title="Average utilization" value={`${averageUtilization.toFixed(1)}%`} help="Team hours against capacity" /><Summary icon={<CircleDollarSign size={15} />} title="Approved billing" value={formatPKR(totalBilled)} help="Departmental period totals" /></div>
    <section className="mb-5 rounded-lg border border-zinc-200 bg-white p-4"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-[12px] font-semibold">Department performance</h2><p className="mt-1 text-[10px] text-zinc-500">Realization compares billed value with fees earned; utilization compares logged hours with weekly capacity.</p></div><div className="flex items-center gap-3 text-[9px] text-zinc-500"><span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-emerald-600" /> Realization</span><span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-zinc-300" /> Utilization</span></div></div>
      <div className="space-y-3">{departments.map((department) => { const item = departmentPerformance[department]; return <div key={department} className="grid grid-cols-[92px_minmax(0,1fr)_54px_54px] items-center gap-3"><p className="text-[10px] font-medium text-zinc-700">{department}</p><div className="space-y-1"><div className="h-2 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-emerald-700" style={{ width: `${item.realization}%` }} /></div><div className="h-2 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-zinc-300" style={{ width: `${item.utilization}%` }} /></div></div><p className="text-right text-[10px] font-medium tabular-nums text-emerald-800">{item.realization}%</p><p className="text-right text-[10px] tabular-nums text-zinc-500">{item.utilization}%</p></div>; })}</div><div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-[9px] text-zinc-500"><span>Target utilization: 85%</span><span className="tabular-nums">Period billing: {formatPKR(totalBilled)}</span></div>
    </section>
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white"><div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3"><div><h2 className="text-[12px] font-semibold">Client margin</h2><p className="mt-0.5 text-[10px] text-zinc-500">Contract value compared with estimated internal delivery cost.</p></div><Badge>Illustrative · PKR</Badge></div><div className="table-scroll"><table className="w-full min-w-[740px] border-collapse text-left"><thead className="bg-zinc-50"><tr>{table.getHeaderGroups()[0].headers.map((header) => <th key={header.id} className="border-b border-zinc-200 px-3 py-2.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-zinc-500"><button className="inline-flex items-center gap-1" onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}{header.column.getIsSorted() === "asc" ? <ArrowUp size={10} /> : header.column.getIsSorted() === "desc" ? <ArrowDown size={10} /> : null}</button></th>)}</tr></thead><tbody>{table.getRowModel().rows.map((row) => <tr key={row.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60">{row.getVisibleCells().map((cell) => <td key={cell.id} className="px-3 py-3 text-[10px]">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody><tfoot><tr className="bg-zinc-50 font-semibold"><td colSpan={2} className="px-3 py-3 text-[10px]">Portfolio total</td><td className="px-3 py-3 text-[10px] tabular-nums">{formatPKR(marginRows.reduce((sum, item) => sum + item.contractFee, 0))}</td><td className="px-3 py-3 text-[10px] tabular-nums">{formatPKR(marginRows.reduce((sum, item) => sum + item.internalCost, 0))}</td><td className="px-3 py-3 text-[10px] tabular-nums">{(marginRows.reduce((sum, item) => sum + item.margin, 0) / marginRows.length).toFixed(1)}%</td></tr></tfoot></table></div></section>
    <p aria-live="polite" className="mt-3 text-[10px] text-emerald-800">{exportStatus}</p>
  </>;
}

function Summary({ icon, title, value, help }: { icon: React.ReactNode; title: string; value: string; help: string }) { return <section className="rounded-lg border border-zinc-200 bg-white p-3.5"><div className="flex items-center justify-between text-zinc-500"><span className="text-[10px] font-medium">{title}</span>{icon}</div><p className="mt-2 text-[20px] font-semibold tracking-[-0.04em] tabular-nums">{value}</p><p className="mt-1 text-[9px] text-zinc-500">{help}</p></section>; }

function PermissionNotice() { return <div className="mx-auto mt-16 max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center"><div className="mx-auto grid size-10 place-items-center rounded-full bg-zinc-100 text-zinc-600"><CircleDollarSign size={18} /></div><h1 className="mt-4 text-base font-semibold">Partner access required</h1><p className="mt-2 text-xs leading-5 text-zinc-500">Profitability reports are available to the Managing Partner. Switch roles from the header to see the permitted workspace.</p></div>; }
