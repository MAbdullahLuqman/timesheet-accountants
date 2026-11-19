"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownToLine, BarChart3, CircleDollarSign, Percent } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { useAppState } from "@/lib/portal-state";
import { getReportsData } from "@/lib/supabase/actions";
import { formatPKR } from "@/lib/format";

type ReportData = { role: "PARTNER" | "HEAD"; total_logged_hours: number; billable_utilization: number; realization: number; departments: { department: string; logged_hours: number; utilization: number; realization: number }[]; margins: { client_name: string; fee_pkr: number; internal_cost_pkr: number; margin_percent: number }[]; csvRows: { entry_id: string; work_date: string; staff: string; department: string; client: string; engagement: string; task_code: string; logged_hours: number; billed_hours: number }[] };
const dateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const csv = (value: string | number) => { const text = String(value); const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text; return `"${safe.replaceAll('"', '""')}"`; };

export default function ReportsDashboard() {
  const { weekStart } = useAppState();
  const start = dateString(weekStart);
  const end = dateString(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 5));
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exported, setExported] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await getReportsData(start, end);
    if ("error" in result) { setError(result.error); setData(null); }
    else { setData(result.data as ReportData); setError(""); }
    setLoading(false);
  }, [start, end]);
  useEffect(() => { void refresh(); }, [refresh]);
  const exportCsv = () => {
    if (!data) return;
    const headers = ["Entry ID", "Work date", "Staff", "Department", "Client", "Engagement", "Task code", "Logged hours", "Billed hours"];
    const rows = data.csvRows.map((row) => [row.entry_id, row.work_date, row.staff, row.department, row.client, row.engagement, row.task_code, row.logged_hours.toFixed(2), row.billed_hours.toFixed(2)].map(csv).join(","));
    const blob = new Blob([`\uFEFF${[headers.map(csv).join(","), ...rows].join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `approved-time-${start}.csv`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setExported(`${rows.length} approved entries exported.`);
  };

  if (loading) return <p className="py-12 text-center text-xs text-zinc-500">Loading live reports…</p>;
  if (error || !data) return <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">Could not load reports. {error}</div>;
  return <>
    <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={<BarChart3 size={15} />} title="Total logged hours" value={`${data.total_logged_hours.toFixed(2)}h`} help={`${start} to ${end}`} /><Metric icon={<Percent size={15} />} title="Billable utilization" value={`${data.billable_utilization.toFixed(1)}%`} help="Billable hours / weekly capacity" /><Metric icon={<CircleDollarSign size={15} />} title="Realization" value={`${data.realization.toFixed(1)}%`} help="Billed hours / logged hours" /><Metric icon={<ArrowDownToLine size={15} />} title="Approved entries" value={String(data.csvRows.length)} help="Ready for billing export" /></div>
    <section className="mb-5 rounded-lg border border-zinc-200 bg-white p-4"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-[12px] font-semibold">Department performance</h2><p className="mt-1 text-[10px] text-zinc-500">Current selected week; utilization is billable hours against weekly targets.</p></div><Button variant="primary" onClick={exportCsv}><ArrowDownToLine size={14} /> Export approved CSV</Button></div><div className="space-y-3">{data.departments.map((item) => <div key={item.department} className="grid grid-cols-[100px_minmax(0,1fr)_120px] items-center gap-3"><p className="text-[10px] font-medium">{item.department}</p><div className="space-y-1"><div className="h-2 overflow-hidden rounded bg-zinc-100"><div className="h-full rounded bg-emerald-700" style={{ width: `${Math.min(item.realization, 100)}%` }} /></div><div className="h-2 overflow-hidden rounded bg-zinc-100"><div className="h-full rounded bg-zinc-300" style={{ width: `${Math.min(item.utilization, 100)}%` }} /></div></div><div className="text-right text-[9px] tabular-nums"><span className="text-emerald-800">{item.realization.toFixed(1)}%</span><span className="mx-1 text-zinc-300">/</span><span className="text-zinc-500">{item.utilization.toFixed(1)}%</span></div></div>)}</div><div className="mt-3 flex justify-end gap-3 text-[9px] text-zinc-500"><span>Realization</span><span>Billable utilization</span></div></section>
    {data.role === "PARTNER" && <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white"><div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3"><div><h2 className="text-[12px] font-semibold">Client profitability</h2><p className="mt-0.5 text-[10px] text-zinc-500">Contract fees compared with logged hours multiplied by internal cost rates.</p></div><Badge tone="blue">Partner only · PKR</Badge></div><div className="table-scroll"><table className="w-full min-w-[740px] text-left"><thead className="bg-zinc-50"><tr>{["Client", "Contract fee (PKR)", "Internal staff cost (PKR)", "Net margin"].map((heading) => <th key={heading} className="border-b border-zinc-200 px-3 py-2.5 text-[9px] font-semibold uppercase tracking-wide text-zinc-500">{heading}</th>)}</tr></thead><tbody>{data.margins.map((row) => <tr key={row.client_name} className="border-b border-zinc-100 last:border-0"><td className="px-3 py-3 text-[10px] font-medium">{row.client_name}</td><td className="px-3 py-3 text-[10px] tabular-nums">{formatPKR(row.fee_pkr)}</td><td className="px-3 py-3 text-[10px] tabular-nums">{formatPKR(row.internal_cost_pkr)}</td><td className="px-3 py-3"><Badge tone={row.margin_percent >= 65 ? "green" : row.margin_percent >= 45 ? "amber" : "rose"}>{row.margin_percent.toFixed(1)}%</Badge></td></tr>)}{!data.margins.length && <tr><td colSpan={4} className="py-10 text-center text-xs text-zinc-500">No engagements to report.</td></tr>}</tbody></table></div></section>}
    <p aria-live="polite" className="mt-3 text-[10px] text-emerald-800">{exported}</p>
  </>;
}

function Metric({ icon, title, value, help }: { icon: React.ReactNode; title: string; value: string; help: string }) { return <section className="rounded-lg border border-zinc-200 bg-white p-3.5"><div className="flex items-center justify-between text-zinc-500"><span className="text-[10px] font-medium">{title}</span>{icon}</div><p className="mt-2 text-[20px] font-semibold tabular-nums">{value}</p><p className="mt-1 text-[9px] text-zinc-500">{help}</p></section>; }
