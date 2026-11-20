"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { saveTimeEntries, submitWeek, type TimeEntryInput } from "@/lib/supabase/actions";
import { useAppState } from "@/lib/portal-state";

type Entry = TimeEntryInput & { status: string; review_comment?: string | null };
const tasks = ["FBR Income Tax / IRIS", "Sales Tax / SRB / PRA", "WHT Reconciliation", "Statutory Audit", "SECP Filing", "Bookkeeping", "Exam Leave / Admin"];
const day = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export default function Timesheet({ initialStart, initialEntries, initialError }: { initialStart: string; initialEntries: Entry[]; initialError?: string }) {
  const { weekStart, activeEngagements } = useAppState();
  const start = day(weekStart);
  const endDate = new Date(weekStart);
  endDate.setDate(endDate.getDate() + 5);
  const end = day(endDate);
  const [rows, setRows] = useState<Entry[]>([]);
  const queryClient = useQueryClient();
  const weekQuery = useQuery({ queryKey: ["timesheet-week", start], queryFn: async () => {
    const response = await fetch(`/api/accountant/week?start=${start}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Could not load timesheet.");
    return result as { entries: Entry[] };
  }, initialData: start === initialStart ? { entries: initialEntries } : undefined });
  const loading = weekQuery.isPending;
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { if (weekQuery.data) { setRows(weekQuery.data.entries.map((row) => ({ ...row, logged_hours: Number(row.logged_hours) }))); setDirty(false); } }, [weekQuery.data]);
  useEffect(() => { if (weekQuery.error) setMessage(weekQuery.error.message); else if (initialError) setMessage(initialError); }, [weekQuery.error, initialError]);

  const edit = (id: string, change: Partial<Entry>) => { setRows((current) => current.map((row) => row.id === id ? { ...row, ...change } : row)); setDirty(true); };
  const add = () => { if (activeEngagements[0]) { setRows((current) => [...current, { id: crypto.randomUUID(), engagement_id: activeEngagements[0].id, task_code: tasks[0], work_date: start, logged_hours: 0.25, billable: true, notes: "", status: "DRAFT" }]); setDirty(true); } };
  const save = async () => {
    setBusy(true); setMessage("");
    try {
      const editable = rows.filter((row) => ["DRAFT", "RETURNED"].includes(row.status));
      const result = await saveTimeEntries(editable.map(({ id, engagement_id, task_code, work_date, logged_hours, billable, notes }) => ({ id, engagement_id, task_code, work_date, logged_hours: Number(logged_hours), billable, notes })));
      if ("error" in result) { setMessage(result.error); return false; }
      setDirty(false); setMessage("Timesheet saved."); return true;
    } catch { setMessage("Could not save timesheet. Try again."); return false; }
    finally { setBusy(false); }
  };
  const submit = async () => {
    if (dirty && !await save()) return;
    setBusy(true); setMessage("");
    try {
      const result = await submitWeek(start, end);
      if ("error" in result) { setMessage(result.error); return; }
      setRows((current) => current.map((row) => ["DRAFT", "RETURNED"].includes(row.status) ? { ...row, status: "SUBMITTED", review_comment: null } : row));
      setMessage("Week submitted for review.");
    } catch { setMessage("Could not submit week. Try again."); }
    finally { setBusy(false); }
  };
  const canSubmit = rows.some((row) => ["DRAFT", "RETURNED"].includes(row.status));
  return <main id="main-content" className="p-4 sm:p-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold">My weekly timesheet</h1><p className="text-sm text-zinc-500">{start} to {end} · {rows.reduce((sum, row) => sum + Number(row.logged_hours), 0).toFixed(2)} hours</p></div><div className="flex gap-2"><button onClick={add} disabled={loading || busy || !activeEngagements.length} className="rounded border px-3 py-2 text-sm disabled:opacity-50">Add entry</button><button onClick={() => void save()} disabled={loading || busy || !dirty} className="rounded border px-3 py-2 text-sm disabled:opacity-50">Save</button><button onClick={() => void submit()} disabled={loading || busy || !canSubmit} className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50">Submit week</button></div></div>
    {message && <p role="status" className="mb-4 rounded border bg-white p-3 text-sm">{message}</p>}
    {loading ? <p className="text-sm text-zinc-500">Loading timesheet…</p> : !activeEngagements.length ? <p className="rounded border bg-white p-5 text-sm">No active client engagements exist yet. A Partner can create the first one.</p> : <div className="overflow-x-auto rounded border bg-white"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-zinc-50 text-xs text-zinc-500"><tr>{["Date", "Engagement", "Task", "Hours", "Billable", "Notes", "Status"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{rows.map((row) => { const locked = !["DRAFT", "RETURNED"].includes(row.status); return <tr key={row.id} className="border-t"><td className="p-2"><input type="date" min={start} max={end} value={row.work_date} disabled={locked} onChange={(event) => edit(row.id, { work_date: event.target.value })} className="rounded border p-2 disabled:border-transparent" /></td><td className="p-2"><select value={row.engagement_id} disabled={locked} onChange={(event) => edit(row.id, { engagement_id: event.target.value })} className="w-full rounded border p-2 disabled:border-transparent">{activeEngagements.map((engagement) => <option key={engagement.id} value={engagement.id}>{engagement.client_name} · {engagement.title}</option>)}</select></td><td className="p-2"><select value={row.task_code} disabled={locked} onChange={(event) => edit(row.id, { task_code: event.target.value, billable: event.target.value !== "Exam Leave / Admin" })} className="w-full rounded border p-2 disabled:border-transparent">{tasks.map((task) => <option key={task}>{task}</option>)}</select></td><td className="p-2"><input type="number" min="0" max="24" step="0.25" value={row.logged_hours} disabled={locked} onChange={(event) => edit(row.id, { logged_hours: Number(event.target.value) })} className="w-20 rounded border p-2 disabled:border-transparent" /></td><td className="p-2"><input type="checkbox" checked={row.billable} disabled={locked} onChange={(event) => edit(row.id, { billable: event.target.checked })} /></td><td className="p-2"><input value={row.notes} disabled={locked} maxLength={1000} onChange={(event) => edit(row.id, { notes: event.target.value })} className="min-w-36 rounded border p-2 disabled:border-transparent" />{row.review_comment && <p className="text-xs text-amber-700">{row.review_comment}</p>}</td><td className="p-2 text-xs">{row.status}</td></tr>; })}</tbody></table>{!rows.length && <p className="p-5 text-sm text-zinc-500">No entries this week. Choose Add entry to start.</p>}</div>}</main>;
}
