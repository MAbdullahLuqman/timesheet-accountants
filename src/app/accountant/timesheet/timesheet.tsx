"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteDraftTimeEntry, saveTimeEntries, submitWeek, withdrawWeek, type TimeEntryInput } from "@/lib/supabase/actions";
import { useAppState } from "@/lib/portal-state";
import TimesheetExcel from "./timesheet-excel";
import { Badge, Button, Drawer, PageHeading } from "@/components/ui";
import { Eye, Pencil, Trash2 } from "lucide-react";

type Entry = TimeEntryInput & { status: string; review_comment?: string | null };
const tasks = ["FBR Income Tax / IRIS", "Sales Tax / SRB / PRA", "WHT Reconciliation", "Statutory Audit", "SECP Filing", "Bookkeeping", "Exam Leave / Admin"];
const day = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
async function fetchWeek(start: string): Promise<{ entries: Entry[]; tasks: { id: string; engagement_id: string; title: string }[] }> {
  const response = await fetch(`/api/accountant/week?start=${start}`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Could not load timesheet.");
  return result;
}

export default function Timesheet({ initialStart, initialEntries, initialTasks, initialError }: { initialStart: string; initialEntries: Entry[]; initialTasks: { id: string; engagement_id: string; title: string }[]; initialError?: string }) {
  const { weekStart, activeEngagements, profile } = useAppState();
  const start = day(weekStart);
  const endDate = new Date(weekStart);
  endDate.setDate(endDate.getDate() + 5);
  const end = day(endDate);
  const [rows, setRows] = useState<Entry[]>([]);
  const queryClient = useQueryClient();
  const weekQuery = useQuery({ queryKey: ["timesheet-week", profile.id, start], queryFn: () => fetchWeek(start), initialData: start === initialStart ? { entries: initialEntries, tasks: initialTasks } : undefined });
  const loading = weekQuery.isPending;
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => { if (weekQuery.data) { setRows(weekQuery.data.entries.map((row) => ({ ...row, logged_hours: Number(row.logged_hours) }))); setDirty(false); } }, [weekQuery.data]);
  useEffect(() => {
    for (const offset of [-7, 7]) {
      const adjacent = new Date(`${start}T12:00:00Z`);
      adjacent.setUTCDate(adjacent.getUTCDate() + offset);
      const adjacentStart = adjacent.toISOString().slice(0, 10);
      void queryClient.prefetchQuery({ queryKey: ["timesheet-week", profile.id, adjacentStart], queryFn: () => fetchWeek(adjacentStart) });
    }
  }, [start, profile.id, queryClient]);
  useEffect(() => { if (weekQuery.error) setMessage(weekQuery.error.message); else if (initialError) setMessage(initialError); }, [weekQuery.error, initialError]);

  const edit = (id: string, change: Partial<Entry>) => { setRows((current) => current.map((row) => row.id === id ? { ...row, ...change } : row)); setDirty(true); };
  const save = async () => {
    setBusy(true); setMessage("");
    try {
      const editable = rows.filter((row) => ["DRAFT", "RETURNED"].includes(row.status));
      const result = await saveTimeEntries(editable.map(({ id, engagement_id, task_id, task_code, work_date, logged_hours, billable, notes }) => ({ id, engagement_id, task_id, task_code, work_date, logged_hours: Number(logged_hours), billable, notes })));
      if ("error" in result) { setMessage(result.error); return false; }
      queryClient.setQueryData(["timesheet-week", profile.id, start], { entries: rows });
      setDirty(false); setEditingId(null); setMessage("Timesheet saved."); return true;
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
      queryClient.setQueryData(["timesheet-week", profile.id, start], { entries: rows.map((row) => ["DRAFT", "RETURNED"].includes(row.status) ? { ...row, status: "SUBMITTED" } : row) });
      setEditingId(null); setMessage(`Entire week submitted for review (${result.count} entries).`);
    } catch { setMessage("Could not submit week. Try again."); }
    finally { setBusy(false); }
  };
  async function startEdit(id: string, status: string) {
    if (status === "SUBMITTED") {
      if (!window.confirm("Withdraw the entire submitted week to edit this row? You will need to submit the week again.")) return;
      if (dirty && !await save()) return;
      setBusy(true); setMessage("");
      try {
        const result = await withdrawWeek(start, end);
        if ("error" in result) { setMessage(result.error); return; }
        await queryClient.invalidateQueries({ queryKey: ["timesheet-week", profile.id, start] });
        setMessage("Week returned to draft. Edit the row, then submit the week again.");
      } catch { setMessage("Could not withdraw the week. Try again."); return; }
      finally { setBusy(false); }
    }
    setEditingId(id);
  }
  async function remove(id: string, status: string) {
    if (!window.confirm(status === "SUBMITTED" ? "Withdraw the entire week and delete this row? The remaining rows will need resubmission." : "Delete this draft time entry?")) return;
    if (dirty && !await save()) return;
    setBusy(true); setMessage("");
    try {
      if (status === "SUBMITTED") {
        const withdrawn = await withdrawWeek(start, end);
        if ("error" in withdrawn) { setMessage(withdrawn.error); return; }
      }
      const result = await deleteDraftTimeEntry(id);
      if ("error" in result) { setMessage(result.error); return; }
      await queryClient.invalidateQueries({ queryKey: ["timesheet-week", profile.id, start] });
      setMessage(status === "SUBMITTED" ? "Row deleted. Submit the remaining week again." : "Draft entry deleted.");
    } catch { setMessage("Could not delete the draft. Try again."); }
    finally { setBusy(false); }
  }
  async function withdraw() {
    if (!window.confirm("Withdraw this submitted week so you can edit its entries?")) return;
    if (dirty && !await save()) return;
    setBusy(true); setMessage("");
    try {
      const result = await withdrawWeek(start, end);
      if ("error" in result) { setMessage(result.error); return; }
      await queryClient.invalidateQueries({ queryKey: ["timesheet-week", profile.id, start] });
      setMessage(`${result.count} entries returned to draft. Edit them, then submit the week again.`);
    } catch { setMessage("Could not withdraw the week. Try again."); }
    finally { setBusy(false); }
  }
  const canSubmit = rows.some((row) => ["DRAFT", "RETURNED"].includes(row.status));
  const canWithdraw = rows.some((row) => row.status === "SUBMITTED") && !rows.some((row) => ["APPROVED", "RETURNED"].includes(row.status));
  const viewed = rows.find((row) => row.id === viewId);
  const loggedHours = rows.reduce((sum, row) => sum + Number(row.logged_hours), 0);
  const pendingHours = rows.filter((row) => row.status === "SUBMITTED").reduce((sum, row) => sum + Number(row.logged_hours), 0);
  const weekStatus = rows.some((row) => row.status === "DRAFT" || row.status === "RETURNED") ? "Draft · ready to submit" : rows.some((row) => row.status === "SUBMITTED") ? "Submitted for review" : rows.length && rows.every((row) => row.status === "APPROVED") ? "Approved" : "No entries";
  const approvedHours = rows.filter((row) => row.status === "APPROVED").reduce((sum, row) => sum + Number(row.logged_hours), 0);
  async function quickAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dirty && !await save()) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setMessage("");
    try {
      const result = await saveTimeEntries([{ id: crypto.randomUUID(), work_date: String(values.get("date")), engagement_id: String(values.get("engagement")), task_code: String(values.get("task")), logged_hours: Number(values.get("hours")), billable: values.has("billable"), notes: String(values.get("notes") ?? "") }]);
      if ("error" in result) { setMessage(result.error); return; }
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ["timesheet-week", profile.id, start] });
      setMessage("Draft time entry added.");
    } catch { setMessage("Could not add the time entry. Try again."); }
    finally { setBusy(false); }
  }
  return <>
    <PageHeading title="Weekly timesheet" subtitle="Record client work and submit the week for review." actions={<TimesheetExcel rows={rows} start={start} end={end} busy={loading || busy} dirty={dirty} />} />
    <div className="mb-4 flex flex-wrap items-center gap-3"><p className="text-xs font-medium text-zinc-600">Week of {start} to {end}</p><Badge tone={weekStatus === "Approved" ? "green" : weekStatus === "Submitted for review" ? "amber" : "neutral"}>{weekStatus}</Badge></div>
    <div className="mb-5 grid gap-3 sm:grid-cols-3">{[["Total logged", loggedHours], ["Approved hours", approvedHours], ["Pending review", pendingHours]].map(([label, value]) => <div key={label} className="rounded-lg border border-zinc-200 bg-white p-4"><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums">{Number(value).toFixed(2)}h</p></div>)}</div>
    {!!activeEngagements.length && <form onSubmit={(event) => void quickAdd(event)} className="mb-5 rounded-lg border border-zinc-200 bg-white p-4"><h2 className="mb-3 text-sm font-semibold">Quick add time entry</h2><div className="grid gap-3 md:grid-cols-5"><label className="text-xs">Date<input key={start} name="date" type="date" min={start} max={end} defaultValue={start} required className="field-input mt-1" /></label><label className="text-xs">Engagement<select name="engagement" required className="field-select mt-1">{activeEngagements.map((item) => <option key={item.id} value={item.id}>{item.client_name} · {item.title}</option>)}</select></label><label className="text-xs">Task<select name="task" className="field-select mt-1">{tasks.map((task) => <option key={task}>{task}</option>)}</select></label><label className="text-xs">Hours<input name="hours" type="number" min="0.25" max="24" step="0.25" defaultValue="0.25" required className="field-input mt-1" /></label><label className="text-xs">Notes<input name="notes" maxLength={1000} placeholder="Work completed" className="field-input mt-1" /></label></div><div className="mt-3 flex items-center justify-between"><label className="text-xs"><input name="billable" type="checkbox" defaultChecked className="mr-2" />Billable to client</label><Button type="submit" variant="primary" disabled={busy || loading}>Add draft row</Button></div></form>}
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Time entries</h2><div className="flex gap-2"><Button onClick={() => void save()} disabled={loading || busy || !dirty}>Save edits</Button>{rows.some((row) => row.status === "SUBMITTED") && <Button disabled={loading || busy || !canWithdraw} title={canWithdraw ? "Return the submitted week to draft" : "The Partner has already reviewed part of this week"} onClick={() => void withdraw()}>Withdraw week</Button>}<Button variant="primary" onClick={() => void submit()} disabled={loading || busy || !canSubmit}>Submit entire week</Button></div></div>
    {message && <p role="status" className="mb-4 rounded border bg-white p-3 text-sm">{message}</p>}
    {loading ? <p className="text-sm text-zinc-500">Loading timesheet…</p> : !activeEngagements.length ? <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm">No active client engagements exist yet. A Partner can create the first one.</p> : <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-zinc-50 text-xs text-zinc-500"><tr>{["Date", "Engagement", "Deliverable", "Task", "Hours", "Billable", "Notes", "Status", "Actions"].map((label) => <th key={label} className={label === "Actions" ? "sticky right-0 z-10 bg-zinc-50 p-3" : "p-3"}>{label}</th>)}</tr></thead><tbody>{rows.map((row) => { const editable = ["DRAFT", "RETURNED", "SUBMITTED"].includes(row.status); const locked = row.status === "SUBMITTED" || !editable || editingId !== row.id; return <tr key={row.id} className="border-t"><td className="p-2"><input type="date" min={start} max={end} value={row.work_date} disabled={locked} onChange={(event) => edit(row.id, { work_date: event.target.value })} className="rounded border p-2 disabled:border-transparent" /></td><td className="p-2"><select value={row.engagement_id} disabled={locked} onChange={(event) => edit(row.id, { engagement_id: event.target.value, task_id: null })} className="w-full rounded border p-2 disabled:border-transparent">{activeEngagements.map((engagement) => <option key={engagement.id} value={engagement.id}>{engagement.client_name} · {engagement.title}</option>)}</select></td><td className="p-2"><select aria-label="Deliverable task" value={row.task_id ?? ""} disabled={locked} onChange={(event) => edit(row.id, { task_id: event.target.value || null })} className="w-full rounded border p-2 disabled:border-transparent"><option value="">General work</option>{(weekQuery.data?.tasks ?? []).filter((task) => task.engagement_id === row.engagement_id).map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></td><td className="p-2"><select value={row.task_code} disabled={locked} onChange={(event) => edit(row.id, { task_code: event.target.value, billable: event.target.value !== "Exam Leave / Admin" })} className="w-full rounded border p-2 disabled:border-transparent">{tasks.map((task) => <option key={task}>{task}</option>)}</select></td><td className="p-2"><input type="number" min="0" max="24" step="0.25" value={row.logged_hours} disabled={locked} onChange={(event) => edit(row.id, { logged_hours: Number(event.target.value) })} className="w-20 rounded border p-2 disabled:border-transparent" /></td><td className="p-2"><input type="checkbox" checked={row.billable} disabled={locked} onChange={(event) => edit(row.id, { billable: event.target.checked })} /></td><td className="p-2"><input value={row.notes} disabled={locked} maxLength={1000} onChange={(event) => edit(row.id, { notes: event.target.value })} className="min-w-36 rounded border p-2 disabled:border-transparent" />{row.review_comment && <p className="text-xs text-amber-700">{row.review_comment}</p>}</td><td className="p-2 text-xs"><Badge tone={row.status === "APPROVED" ? "green" : row.status === "RETURNED" ? "rose" : row.status === "SUBMITTED" ? "amber" : "neutral"}>{row.status}</Badge></td><td className="sticky right-0 z-10 bg-white p-2"><div className="flex gap-1"><Button aria-label={`View entry from ${row.work_date}`} onClick={() => setViewId(row.id)}><Eye size={13} />View</Button><Button aria-label={`Edit entry from ${row.work_date}`} disabled={busy || !editable || row.status === "SUBMITTED" && !canWithdraw} title={editable ? row.status === "SUBMITTED" ? "Withdraw the whole week, then edit this row" : "Edit this row" : "Approved entries are locked"} onClick={() => editingId === row.id ? void save() : void startEdit(row.id, row.status)}><Pencil size={13} />{editingId === row.id ? "Save" : "Edit"}</Button><Button aria-label={`Delete entry from ${row.work_date}`} variant="danger" disabled={busy || !["DRAFT", "RETURNED", "SUBMITTED"].includes(row.status) || row.status === "SUBMITTED" && !canWithdraw} title={row.status === "SUBMITTED" ? "Withdraw the whole week, then delete this row" : ["DRAFT", "RETURNED"].includes(row.status) ? "Delete this row" : "Approved entries cannot be deleted"} onClick={() => void remove(row.id, row.status)}><Trash2 size={13} />Delete</Button></div></td></tr>; })}</tbody></table>{!rows.length && <p className="p-5 text-sm text-zinc-500">No entries this week. Use Quick add time entry to start.</p>}</div>}<Drawer open={!!viewed} onOpenChange={(open) => !open && setViewId(null)} title="Time entry" description={viewed ? `${viewed.work_date} · ${viewed.status}` : undefined} className="!w-full max-w-md">{viewed && <div className="space-y-4 p-5 text-sm"><p><strong>Engagement</strong><br />{activeEngagements.find((item) => item.id === viewed.engagement_id)?.client_name ?? "Current or archived engagement"}</p><p><strong>Task</strong><br />{viewed.task_code}</p><p><strong>Hours</strong><br />{Number(viewed.logged_hours).toFixed(2)}h · {viewed.billable ? "Billable" : "Non-billable"}</p><p><strong>Notes</strong><br />{viewed.notes || "No notes entered"}</p>{viewed.review_comment && <p><strong>Partner comment</strong><br />{viewed.review_comment}</p>}{viewed.status === "SUBMITTED" && <p className="rounded-lg bg-[var(--accent-soft)] p-3 text-xs text-[var(--accent)]">This entry is locked while the week is awaiting Partner review. Use Withdraw week to make changes.</p>}</div>}</Drawer></>;
}
