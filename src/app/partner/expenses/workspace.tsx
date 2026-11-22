"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Drawer, PageHeading } from "@/components/ui";
import { formatPKR } from "@/lib/format";
import { approveStaffExpenses, reviewExpense, setExpenseBillable } from "@/lib/supabase/expense-actions";

type Row = { id: string; user_id: string; expense_date: string; location_client: string; reason: string; amount_pkr: number; billable_to_client: boolean; status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED"; review_comment: string | null };
type Staff = { id: string; full_name: string; designation: string | null; department: string };
export default function Expenses({ rows, staff, error }: { rows: Row[]; staff: Staff[]; error?: string }) {
  const router = useRouter();
  const [month, setMonth] = useState(() => rows[0]?.expense_date.slice(0, 7) ?? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`);
  useEffect(() => { const saved = new URLSearchParams(window.location.search).get("month"); if (saved && /^\d{4}-(0[1-9]|1[0-2])$/.test(saved)) setMonth(saved); }, []);
  const selectMonth = (value: string) => { setMonth(value); const url = new URL(window.location.href); url.searchParams.set("month", value); window.history.replaceState(window.history.state, "", url); };
  const [selected, setSelected] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState(error ?? "");
  const [pending, startTransition] = useTransition();
  const visible = rows.filter((r) => r.expense_date.startsWith(month) && (r.status === "SUBMITTED" || r.status === "APPROVED"));
  const staffRows = staff.map((person) => ({ ...person, claims: visible.filter((r) => r.user_id === person.id) })).filter((s) => s.claims.length);
  const act = (task: () => Promise<{ error?: string; success?: boolean }>) => startTransition(async () => { const result = await task(); setNotice(result.error ?? "Claims updated."); if (result.success) router.refresh(); });
  return <>
    <PageHeading title="Travelling & Expenses" subtitle="Review monthly claims and approve employee payouts." />
    <label className="mb-4 block text-xs font-medium">Claim month<input aria-label="Claim month" type="month" value={month} onChange={(e) => selectMonth(e.target.value)} className="field-input mt-1 max-w-48" /></label>
    {notice && <p role="status" className="mb-4 rounded border border-zinc-200 bg-white p-3 text-xs">{notice}</p>}
    <h2 className="mb-3 text-sm font-semibold">Employee payout summary</h2>
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white"><table className="w-full min-w-[950px] text-left text-xs"><thead className="bg-zinc-50"><tr>{["Name", "Designation", "Department", "Total Claimed", "Client-Billable Portion", "Firm Overhead Portion", "Status", "Action"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{staffRows.map((s) => { const total = s.claims.reduce((sum, r) => sum + Number(r.amount_pkr), 0); const billable = s.claims.filter((r) => r.billable_to_client).reduce((sum, r) => sum + Number(r.amount_pkr), 0); const pendingCount = s.claims.filter((r) => r.status === "SUBMITTED").length; return <tr key={s.id} className="border-t border-zinc-100"><td className="p-3"><button className="font-medium underline" onClick={() => setSelected(s.id)}>{s.full_name}</button></td><td className="p-3">{s.designation || "—"}</td><td className="p-3">{s.department}</td><td className="p-3">{formatPKR(total)}</td><td className="p-3">{formatPKR(billable)}</td><td className="p-3">{formatPKR(total - billable)}</td><td className="p-3"><Badge tone={pendingCount ? "amber" : "green"}>{pendingCount ? `${pendingCount} pending` : "Approved"}</Badge></td><td className="p-3"><div className="flex gap-2"><Button onClick={() => setSelected(s.id)}>Inspect</Button><Button variant="primary" disabled={pending || !pendingCount} onClick={() => act(() => approveStaffExpenses(s.id, month))}>Approve All for Staff</Button></div></td></tr>; })}{!staffRows.length && <tr><td colSpan={8} className="p-8 text-center text-zinc-500">No submitted claims this month.</td></tr>}</tbody></table></div>
    <Drawer open={!!selected} onOpenChange={(open) => !open && setSelected(null)} title={staff.find((s) => s.id === selected)?.full_name ?? "Claim rows"} description={`${month} travelling and expense claims`} className="!w-full max-w-3xl"><div className="max-h-[80vh] space-y-3 overflow-y-auto p-5">{visible.filter((r) => r.user_id === selected).map((r) => <section key={r.id} className="rounded-lg border border-zinc-200 p-4 text-xs"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{r.expense_date} · {r.location_client}</p><p className="mt-1">{r.reason}</p></div><strong>{formatPKR(Number(r.amount_pkr))}</strong></div><div className="mt-3 flex items-center gap-3"><Badge tone={r.status === "APPROVED" ? "green" : "amber"}>{r.status}</Badge><label><input type="checkbox" checked={r.billable_to_client} disabled={pending || r.status !== "SUBMITTED"} onChange={(e) => act(() => setExpenseBillable(r.id, e.target.checked))} className="mr-2" />Billable to client</label></div>{r.status === "SUBMITTED" && <div className="mt-3 flex flex-wrap items-center gap-2"><Button variant="primary" disabled={pending} onClick={() => act(() => reviewExpense(r.id, "APPROVED"))}>Approve</Button><input aria-label={`Rejection comment for ${r.location_client}`} placeholder="Reason for rejection" value={comments[r.id] ?? ""} onChange={(e) => setComments({ ...comments, [r.id]: e.target.value })} className="field-input max-w-xs" /><Button disabled={pending || !comments[r.id]?.trim()} onClick={() => act(() => reviewExpense(r.id, "REJECTED", comments[r.id]))}>Reject with Comment</Button></div>}</section>)}</div></Drawer>
  </>;
}
