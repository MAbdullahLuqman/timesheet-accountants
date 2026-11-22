"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, PageHeading } from "@/components/ui";
import { leaveAllowance, workingDays, type Leave, type LeaveType } from "@/lib/leave";
import { applyForLeave, cancelLeave } from "@/lib/supabase/leave-actions";

const labels: Record<LeaveType, string> = { CASUAL: "Casual", SICK: "Sick", ANNUAL: "Annual", ICAP_ACCA_EXAM: "ICAP/ACCA Exam Leave" };
export default function Leaves({ rows, error }: { rows: Leave[]; error?: string }) {
  const router = useRouter();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [days, setDays] = useState("");
  const [notice, setNotice] = useState(error ?? "");
  const [pending, startTransition] = useTransition();
  const year = new Date().getFullYear();
  const updateDates = (nextStart: string, nextEnd: string) => { setStart(nextStart); setEnd(nextEnd); setDays(String(workingDays(nextStart, nextEnd) || "")); };
  const act = (task: () => Promise<{ error?: string; success?: boolean }>, onSuccess?: () => void) => startTransition(async () => { const result = await task(); setNotice(result.error ?? "Leave request updated."); if (result.success) { onSuccess?.(); router.refresh(); } });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    act(() => applyForLeave({ leave_type: String(data.get("type")) as LeaveType, start_date: start, end_date: end, working_days: Number(days), reason: String(data.get("reason") ?? "") }), () => { form.reset(); setStart(""); setEnd(""); setDays(""); });
  }
  return <>
    <PageHeading title="Leaves" subtitle="Apply for leave and track your requests." />
    {notice && <p role="status" className="mb-4 rounded border bg-white p-3 text-xs">{notice}</p>}
    <div className="mb-5 grid gap-3 sm:grid-cols-4">{(Object.keys(leaveAllowance) as LeaveType[]).map((type) => { const used = rows.filter((r) => r.leave_type === type && r.status === "APPROVED" && r.start_date.startsWith(String(year))).reduce((sum, r) => sum + Number(r.working_days), 0); return <div key={type} className="rounded-lg border border-zinc-200 bg-white p-4"><p className="text-xs text-zinc-500">{labels[type]}</p><p className="mt-2 text-xl font-semibold">{used} used · {Math.max(0, leaveAllowance[type] - used)} remaining</p><p className="text-[10px] text-zinc-500">{year} allowance: {leaveAllowance[type]} days</p></div>; })}</div>
    <form onSubmit={submit} className="mb-5 rounded-lg border border-zinc-200 bg-white p-4"><h2 className="mb-3 text-sm font-semibold">Apply for leave</h2><div className="grid gap-3 sm:grid-cols-4"><label className="text-xs">Leave Type<select name="type" className="field-select mt-1">{(Object.keys(labels) as LeaveType[]).map((type) => <option key={type} value={type}>{labels[type]}</option>)}</select></label><label className="text-xs">Start Date<input type="date" required value={start} onChange={(e) => updateDates(e.target.value, end)} className="field-input mt-1" /></label><label className="text-xs">End Date<input type="date" required min={start} value={end} onChange={(e) => updateDates(start, e.target.value)} className="field-input mt-1" /></label><label className="text-xs">Working Days<input aria-label="Working Days" type="number" min="0.5" max={workingDays(start, end) || undefined} step="0.5" required value={days} onChange={(e) => setDays(e.target.value)} className="field-input mt-1" /></label></div><label className="mt-3 block text-xs">Reason<textarea name="reason" required maxLength={1000} rows={3} className="field-input mt-1" /></label><div className="mt-3 flex justify-end"><Button variant="primary" type="submit" disabled={pending}>Submit leave request</Button></div></form>
    <h2 className="mb-3 text-sm font-semibold">My leave history</h2><div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white"><table className="w-full min-w-[700px] text-left text-xs"><thead className="bg-zinc-50"><tr>{["Type", "Date Range", "Working Days", "Reason", "Status", "Partner Comment", "Action"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{rows.map((r) => <tr key={r.id} className="border-t"><td className="p-3">{labels[r.leave_type]}</td><td className="p-3">{r.start_date} to {r.end_date}</td><td className="p-3">{r.working_days}</td><td className="p-3">{r.reason}</td><td className="p-3"><Badge tone={r.status === "APPROVED" ? "green" : r.status === "REJECTED" ? "rose" : "amber"}>{r.status}</Badge></td><td className="p-3">{r.review_comment || "—"}</td><td className="p-3">{r.status === "PENDING" && <Button disabled={pending} onClick={() => act(() => cancelLeave(r.id))}>Cancel</Button>}</td></tr>)}{!rows.length && <tr><td colSpan={7} className="p-8 text-center text-zinc-500">No leave requests yet.</td></tr>}</tbody></table></div>
  </>;
}
