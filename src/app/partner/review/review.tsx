"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Drawer } from "@/components/ui";
import { useAppState } from "@/lib/portal-state";
import { reviewTimeEntry } from "@/lib/supabase/actions";
import { freezeMonth } from "@/lib/supabase/period-actions";

type Entry = { id: string; user_id: string; engagement_id: string; task_code: string; work_date: string; logged_hours: number; billed_hours: number; notes: string; status: string };
type ReviewData = { entries: Entry[]; staff: { id: string; full_name: string; department_id: string | null; role: string; weekly_target_hrs: number }[]; engagements: { id: string; client_name: string; title: string; department_id: string | null; budget_hours: number }[]; departments: { id: string; name: string }[]; leaves: { id: string; user_id: string; leave_type: string; start_date: string; end_date: string; working_days: number }[]; audits: { id: string; time_entry_id: string; actor_id: string; action: string; old_billed_hours: number | null; new_billed_hours: number | null; comment: string | null; created_at: string }[] };
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export default function Review({ initialStart, initialData, initialError }: { initialStart: string; initialData: ReviewData; initialError?: string }) {
  const { weekStart, profile } = useAppState();
  const router = useRouter();
  const start = dateKey(weekStart);
  const queryClient = useQueryClient();
  const key = ["partner-review", profile.id, start];
  const { data, isPending, error } = useQuery({ queryKey: key, queryFn: async (): Promise<ReviewData> => { const response = await fetch(`/api/partner/review?start=${start}`); const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Could not load review."); return result; }, initialData: start === initialStart ? initialData : undefined });
  const [message, setMessage] = useState(initialError ?? "");
  const [drafts, setDrafts] = useState<Record<string, { billed: string; comment: string }>>({});
  const [month, setMonth] = useState(start.slice(0, 7));
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const mutation = useMutation({ mutationFn: async (input: { id: string; action: "approve" | "return"; billedHours: number; comment?: string }) => { const result = await reviewTimeEntry(input); if ("error" in result) throw new Error(result.error); return result; }, onError: (failure) => setMessage(failure.message), onSettled: () => { void queryClient.invalidateQueries({ queryKey: key }); router.refresh(); } });
  const entries = data?.entries ?? [];
  const submitted = entries.filter((entry) => entry.status === "SUBMITTED");
  const reported = entries.filter((entry) => ["SUBMITTED", "APPROVED"].includes(entry.status));
  const people = new Map(data?.staff.map((person) => [person.id, person]) ?? []);
  const clients = new Map(data?.engagements.map((engagement) => [engagement.id, engagement]) ?? []);
  const departments = new Map(data?.departments.map((department) => [department.id, department.name]) ?? []);
  const staff = data?.staff.filter((person) => person.role !== "PARTNER") ?? [];
  const staffReports = staff.map((person) => ({ ...person, rows: reported.filter((entry) => entry.user_id === person.id) })).filter((person) => person.rows.length);
  const selectedRows = reported.filter((entry) => entry.user_id === selectedStaff);
  const selectedPending = selectedRows.filter((entry) => entry.status === "SUBMITTED");
  const submittedIds = new Set(reported.map((entry) => entry.user_id));
  const defaulters = staff.filter((person) => !submittedIds.has(person.id));
  const total = entries.reduce((sum, entry) => sum + Number(entry.logged_hours), 0);
  const leaveByStaff = new Map<string, string[]>();
  for (const leave of data?.leaves ?? []) leaveByStaff.set(leave.user_id, [...(leaveByStaff.get(leave.user_id) ?? []), `${leave.leave_type.replaceAll("_", " ")} ${leave.start_date}–${leave.end_date}`]);
  const weak = (entry: Entry) => Number(entry.logged_hours) >= 2 && entry.notes.trim().length < 10;
  const copyDefaulters = async () => { const groups = new Map<string, string[]>(); for (const person of defaulters) { const department = departments.get(person.department_id ?? "") ?? "Unassigned"; groups.set(department, [...(groups.get(department) ?? []), person.full_name]); } await navigator.clipboard.writeText(`Timesheet follow-up (${start})\n${[...groups].map(([name, names]) => `${name}: ${names.join(", ")}`).join("\n")}`); setMessage("Defaulter list copied."); };
  async function approveStaffWeek() {
    setBulkBusy(true); setMessage("");
    try {
      const results = await Promise.all(selectedPending.map((entry) => reviewTimeEntry({ id: entry.id, action: "approve", billedHours: Number(drafts[entry.id]?.billed ?? entry.logged_hours), bulk: true })));
      const failures = results.filter((result) => "error" in result);
      setMessage(failures.length ? `${results.length - failures.length} entries approved; ${failures.length} could not be approved. ${failures[0].error}` : `${results.length} entries approved for ${people.get(selectedStaff ?? "")?.full_name ?? "staff"}.`);
      await queryClient.invalidateQueries({ queryKey: key }); router.refresh();
    } catch { setMessage("Could not approve this timesheet. Try again."); }
    finally { setBulkBusy(false); }
  }
  return <>
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-semibold">End-of-week review</h1><p className="text-sm text-zinc-500">{start} · staff timesheets for this week</p></div><div className="flex flex-wrap gap-2"><input aria-label="Month to freeze" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="rounded border px-2 text-sm" /><Button onClick={() => void freezeMonth(month).then((result) => setMessage("error" in result ? result.error ?? "Could not freeze month." : `Locked through ${result.lockedThrough}.`))}>Freeze month</Button><Button onClick={() => void copyDefaulters()} disabled={!defaulters.length}>Copy defaulter list</Button></div></div>
    <div className="mb-5 grid gap-3 sm:grid-cols-4">{[["Staff submitted", `${submittedIds.size} / ${staff.length}`], ["Hours logged", total.toFixed(2)], ["Awaiting review", String(submitted.length)], ["Unsubmitted", String(defaulters.length)]].map(([label, value]) => <div key={label} className="rounded-lg border bg-white p-4"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div>)}</div>
    {!!leaveByStaff.size && <div className="mb-4 rounded-lg border border-[var(--accent-line)] bg-[var(--accent-soft)] p-3 text-xs"><p className="font-semibold">Approved leave this week</p><div className="mt-2 flex flex-wrap gap-2">{[...leaveByStaff].map(([id, periods]) => <span key={id} className="rounded-full bg-white px-2 py-1 text-[var(--accent)]">{people.get(id)?.full_name ?? "Staff"}: {periods.join(", ")}</span>)}</div></div>}
    {(message || error) && <p role="status" className="mb-4 rounded border bg-white p-3 text-sm">{message || error?.message}</p>}
    {isPending ? <p className="text-sm text-zinc-500">Loading timesheets…</p> : <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-zinc-50 text-xs text-zinc-500"><tr>{["Staff member", "Department", "Entries", "Logged hours", "Status", "Timesheet"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{staffReports.map((person) => { const pending = person.rows.filter((entry) => entry.status === "SUBMITTED").length; return <tr key={person.id} className="border-t"><td className="p-3 font-medium">{person.full_name}</td><td className="p-3">{departments.get(person.department_id ?? "") ?? "Firm-wide"}</td><td className="p-3 tabular-nums">{person.rows.length}</td><td className="p-3 tabular-nums">{person.rows.reduce((sum, entry) => sum + Number(entry.logged_hours), 0).toFixed(2)}h</td><td className="p-3"><Badge tone={pending ? "amber" : "green"}>{pending ? `${pending} awaiting review` : "Approved"}</Badge></td><td className="p-3"><Button onClick={() => setSelectedStaff(person.id)}>Open timesheet</Button></td></tr>; })}</tbody></table>{!staffReports.length && <p className="p-5 text-sm text-zinc-500">No submitted timesheets for this week.</p>}</div>}
    <details className="mt-5 rounded-lg border bg-white p-4"><summary className="cursor-pointer text-sm font-semibold">Audit log</summary><div className="mt-3 space-y-2 text-xs">{(data?.audits ?? []).map((audit) => <p key={audit.id} className="border-t pt-2">{new Date(audit.created_at).toLocaleString("en-PK")} · {audit.action} · Entry {audit.time_entry_id.slice(0, 8)} · {Number(audit.old_billed_hours ?? 0).toFixed(2)}h → {Number(audit.new_billed_hours ?? 0).toFixed(2)}h{audit.comment ? ` · ${audit.comment}` : ""}</p>)}{!data?.audits.length && <p>No review actions recorded yet.</p>}</div></details>
    <Drawer open={!!selectedStaff} onOpenChange={(open) => !open && setSelectedStaff(null)} title={people.get(selectedStaff ?? "")?.full_name ?? "Timesheet"} description={`Weekly timesheet · ${start}`} className="!w-full max-w-[920px]"><div className="p-5">{message && <p role="status" className="mb-4 rounded border border-zinc-200 bg-white p-3 text-xs">{message}</p>}<div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm">{selectedRows.length} entries · {selectedRows.reduce((sum, entry) => sum + Number(entry.logged_hours), 0).toFixed(2)} logged hours</p><Button variant="primary" disabled={bulkBusy || mutation.isPending || !selectedPending.length} onClick={() => void approveStaffWeek()}>Approve entire timesheet ({selectedPending.length})</Button></div><div className="space-y-3">{selectedRows.map((entry) => <section key={entry.id} className="rounded-lg border border-zinc-200 bg-white p-4 text-sm"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{entry.work_date} · {clients.get(entry.engagement_id)?.client_name ?? "Unknown client"}</p><p className="mt-1 text-xs text-zinc-600">{entry.task_code}</p></div><Badge tone={entry.status === "APPROVED" ? "green" : "amber"}>{entry.status}</Badge></div><p className="mt-3 text-sm">{entry.notes || "No narration"}{weak(entry) && <span className="ml-2 rounded bg-amber-100 px-1 text-xs text-amber-900">Weak narration</span>}</p><div className="mt-3 flex flex-wrap items-end gap-3"><p className="text-xs">Logged: <strong>{Number(entry.logged_hours).toFixed(2)}h</strong></p>{entry.status === "SUBMITTED" && <><label className="text-xs">Billed hours<input aria-label={`Billed hours for ${entry.work_date}`} type="number" min="0" max={entry.logged_hours} step="0.25" value={drafts[entry.id]?.billed ?? String(entry.logged_hours)} onChange={(event) => setDrafts((current) => ({ ...current, [entry.id]: { billed: event.target.value, comment: current[entry.id]?.comment ?? "" } }))} className="field-input !mt-1 w-24" /></label><Button disabled={bulkBusy || mutation.isPending} onClick={() => mutation.mutate({ id: entry.id, action: "approve", billedHours: Number(drafts[entry.id]?.billed ?? entry.logged_hours) })}>Approve row</Button><label className="text-xs">Return reason<input value={drafts[entry.id]?.comment ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [entry.id]: { billed: current[entry.id]?.billed ?? String(entry.logged_hours), comment: event.target.value } }))} className="field-input !mt-1 w-48" /></label><Button variant="danger" disabled={bulkBusy || mutation.isPending || !drafts[entry.id]?.comment?.trim()} onClick={() => mutation.mutate({ id: entry.id, action: "return", billedHours: Number(drafts[entry.id]?.billed ?? entry.logged_hours), comment: drafts[entry.id]?.comment })}>Return row</Button></>}</div></section>)}</div></div></Drawer>
  </>;
}
