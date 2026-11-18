"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AlertCircle, CalendarDays, Check, Clock3, Plus, Save, Send, Sparkles } from "lucide-react";
import { Badge, Button, Modal, PageHeading } from "@/components/ui";
import { clients, entries, findClient, findStaff, taskCodes, type TimeEntry } from "@/lib/mock-data";
import { useAppState } from "@/lib/app-state";

const emptyHours = () => [0, 0, 0, 0, 0, 0];
const snapHours = (value: number) => Number.isFinite(value) ? Math.max(0, Math.round(value * 4) / 4) : 0;

const staffIdFor = (roleId: string) => roleId === "partner" ? "MP-001" : roleId === "tax-head" ? "H-TAX" : roleId === "audit-head" ? "H-AUD" : "TAX-01";

export default function TimesheetPage() {
  const { role, weekStart, timerLog, timeEntries, setTimeEntries, engagementList } = useAppState();
  const currentWeek = weekStart.toISOString().slice(0, 10);
  const currentStaffId = staffIdFor(role.id);
  const rows = timeEntries.filter((entry) => entry.staffId === currentStaffId && entry.weekOf === currentWeek);
  const [saved, setSaved] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newClient, setNewClient] = useState(clients[0].id);
  const [newEngagement, setNewEngagement] = useState(engagementList[0].id);
  const [newCode, setNewCode] = useState(taskCodes[0]);
  const dateLabels = useMemo(() => Array.from({ length: 6 }, (_, index) => new Date(weekStart.getTime() + index * 86400000).toLocaleDateString("en-PK", { weekday: "short", day: "numeric" })), [weekStart]);
  const returned = rows.find((row) => row.comment && row.status !== "Submitted");
  const locked = rows.length > 0 && rows.every((row) => row.status === "Submitted" || row.status === "Approved");
  const isApproved = rows.length > 0 && rows.every((row) => row.status === "Approved");
  const isSubmitted = locked && !isApproved;
  const dueDate = new Date(weekStart.getTime() + 5 * 86400000).toLocaleDateString("en-PK", { weekday: "short", month: "short", day: "numeric" });
  const lastTimerSequence = useRef(0);
  useEffect(() => { setSaved(false); }, [role.id, currentWeek]);
  useEffect(() => {
    if (!timerLog || timerLog.roleId !== role.id || timerLog.weekOf !== currentWeek || timerLog.sequence <= lastTimerSequence.current) return;
    lastTimerSequence.current = timerLog.sequence;
    const engagement = engagementList.find((item) => item.clientId === timerLog.clientId);
    if (!engagement) return;
    setTimeEntries((current) => {
      if (current.some((row) => row.id === `TIMER-${timerLog.sequence}`)) return current;
      const existing = current.find((row) => row.staffId === currentStaffId && row.weekOf === currentWeek && row.engagementId === engagement.id && row.status === "Draft");
      if (existing) return current.map((row) => row.id === existing.id ? { ...row, hours: row.hours.map((value, index) => index === 1 ? Math.min(24, snapHours(value + timerLog.hours)) : value) } : row);
      return [{ id: `TIMER-${timerLog.sequence}`, staffId: currentStaffId, engagementId: engagement.id, taskCode: engagement.department === "Audit" ? "Statutory Audit Fieldwork" : engagement.department === "Corporate" ? "SECP Form A / 29" : "FBR Income Tax · IRIS", weekOf: currentWeek, hours: [0, timerLog.hours, 0, 0, 0, 0], note: "Timed client work · add a short summary", status: "Draft", approvedHours: null }, ...current];
    });
    setSaved(false);
  }, [timerLog, role.id, currentWeek, currentStaffId, engagementList, setTimeEntries]);
  const dayTotals = dateLabels.map((_, day) => rows.reduce((sum, row) => sum + Number(row.hours[day] || 0), 0));
  const weekTotal = dayTotals.reduce((sum, hours) => sum + hours, 0);
  const updateRows = (update: (current: TimeEntry[]) => TimeEntry[]) => setTimeEntries((current) => {
    const scoped = current.filter((row) => row.staffId === currentStaffId && row.weekOf === currentWeek);
    const updated = update(scoped);
    const ids = new Set(scoped.map((row) => row.id));
    return [...current.filter((row) => !ids.has(row.id)), ...updated];
  });
  const setCell = (rowId: string, day: number, value: number) => {
    updateRows((current) => current.map((row) => row.id === rowId ? { ...row, hours: row.hours.map((hours, index) => index === day ? Math.min(24, snapHours(value)) : hours) } : row));
    setSaved(false);
  };
  const onCellKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(event.key)) return;
    const input = event.currentTarget;
    const row = Number(input.dataset.row);
    const day = Number(input.dataset.day);
    let nextRow = row;
    let nextDay = day;
    if (event.key === "ArrowUp") nextRow--;
    if (event.key === "ArrowDown" || event.key === "Enter") nextRow++;
    if (event.key === "ArrowLeft") nextDay--;
    if (event.key === "ArrowRight") nextDay++;
    if (nextRow >= 0 && nextRow < rows.length && nextDay >= 0 && nextDay < 6) {
      event.preventDefault();
      document.querySelector<HTMLInputElement>(`[data-row="${nextRow}"][data-day="${nextDay}"]`)?.focus();
    }
  };
  const addRow = () => {
    const engagement = engagementList.find((item) => item.id === newEngagement);
    if (!engagement) return;
    setTimeEntries((current) => [{ id: `NEW-${Date.now()}`, staffId: currentStaffId, engagementId: engagement.id, taskCode: newCode, weekOf: currentWeek, hours: emptyHours(), note: "", status: "Draft", approvedHours: null }, ...current]);
    setAddOpen(false);
    setSaved(false);
  };

  return <>
    <PageHeading title="My weekly timesheet" subtitle={`${role.title} · These are your own hours for the selected week. Entries snap to 15-minute increments.`} actions={<><Button onClick={() => setAddOpen(true)}><Plus size={14} /> Add engagement row</Button><Button variant="primary" onClick={() => updateRows((current) => current.map((row) => ({ ...row, status: "Submitted" })))} disabled={locked}><Send size={13} /> Submit week to head</Button></>} />
    {returned && <div role="status" className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950"><AlertCircle className="mt-0.5 shrink-0 text-amber-700" size={16} /><div className="min-w-0 flex-1"><p className="text-[11px] font-semibold">An entry was returned for review</p><p className="mt-1 text-[11px] leading-4 text-amber-900">{returned.comment} <span className="text-amber-700">· {engagementList.find((item) => item.id === returned.engagementId)?.name}</span></p></div><Badge tone="amber">Action needed</Badge></div>}
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <section className="rounded-lg border border-zinc-200 bg-white p-3.5"><div className="flex items-center justify-between"><span className="text-[10px] font-medium uppercase tracking-[0.07em] text-zinc-500">Week status</span><CalendarDays size={14} className="text-zinc-400" /></div><div className="mt-2 flex items-center gap-2"><Badge tone={isApproved || isSubmitted ? "green" : returned ? "amber" : "neutral"}>{isApproved ? "Approved" : isSubmitted ? "Submitted" : returned ? "Returned" : "Draft"}</Badge><span className="text-[10px] text-zinc-500">Due {dueDate} · 6:00 PM</span></div></section>
      <section className="rounded-lg border border-zinc-200 bg-white p-3.5"><div className="flex items-center justify-between"><span className="text-[10px] font-medium uppercase tracking-[0.07em] text-zinc-500">Hours entered</span><Clock3 size={14} className="text-zinc-400" /></div><p className="mt-1 text-[19px] font-semibold tracking-[-0.04em] tabular-nums">{weekTotal.toFixed(2)}<span className="ml-1 text-[11px] font-normal text-zinc-400">/ 45.00 h</span></p><div className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(100, weekTotal / 45 * 100)}%` }} /></div></section>
      <section className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3.5"><div className="grid size-8 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-800"><Sparkles size={15} /></div><div className="min-w-0"><p className="text-[10px] font-medium text-zinc-700">Keep notes client-ready</p><p className="mt-1 text-[10px] leading-4 text-zinc-500">A clear note makes review and billing faster.</p></div></section>
    </div>
    {locked && <div className="mb-3 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] text-emerald-900"><Check size={13} /> Week submitted. Your entries are locked while your department head reviews them.</div>}
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3"><div><h2 className="text-[12px] font-semibold">Weekly time entries</h2><p className="mt-0.5 text-[10px] text-zinc-500">{dateLabels.join(" · ")} · 0.25h increments</p></div><span className="hidden text-[10px] text-zinc-400 sm:inline">Use ↑ ↓ ← → to move between cells</span></div>
      <div className="timesheet-scroll">
        <table className="timesheet-grid w-full border-collapse text-left">
          <thead><tr className="bg-zinc-50 text-[9px] font-semibold uppercase tracking-[0.06em] text-zinc-500"><th className="sticky left-0 z-10 w-[270px] border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2.5">Client / engagement / task</th>{dateLabels.map((day) => <th key={day} className="w-[82px] border-b border-r border-zinc-200 px-2 py-2.5 text-center">{day}</th>)}<th className="w-[76px] border-b border-r border-zinc-200 px-2 py-2.5 text-center">Total</th><th className="w-[260px] border-b border-zinc-200 px-3 py-2.5">Work summary</th></tr></thead>
          <tbody>{rows.map((row, rowIndex) => {
            const engagement = engagementList.find((item) => item.id === row.engagementId)!;
            const client = findClient(engagement.clientId);
            const staffMember = findStaff(row.staffId);
            const rowTotal = row.hours.reduce((sum, hours) => sum + Number(hours || 0), 0);
            return <tr key={row.id} className="group border-b border-zinc-100 hover:bg-zinc-50/70">
              <td className="sticky left-0 z-[1] border-r border-zinc-100 bg-white px-3 py-2.5 group-hover:bg-zinc-50"><div className="flex items-start gap-2"><span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded border border-zinc-200 bg-white text-[8px] font-semibold text-zinc-500">{client.name.split(" ").slice(0, 2).map((part) => part[0]).join("")}</span><div className="min-w-0"><p className="truncate text-[10px] font-medium text-zinc-800">{client.name}</p><p className="mt-0.5 truncate text-[9px] text-zinc-500">{engagement.name}</p><div className="mt-1 flex items-center gap-1.5"><Badge tone="neutral">{row.taskCode}</Badge><span className="text-[9px] text-zinc-400">{staffMember.name}</span>{row.status === "Returned" && <Badge tone="amber">Returned</Badge>}</div></div></div></td>
              {row.hours.map((hours, dayIndex) => <td key={dayIndex} className="border-r border-zinc-100 px-1.5 py-2 text-center"><input aria-label={`${client.name}, ${dateLabels[dayIndex]} hours`} data-row={rowIndex} data-day={dayIndex} disabled={locked} type="number" min="0" max="24" step="0.25" value={hours || ""} placeholder="—" onKeyDown={onCellKeyDown} onChange={(event) => setCell(row.id, dayIndex, Number(event.target.value))} onBlur={(event) => setCell(row.id, dayIndex, Number(event.target.value))} className="h-8 w-[58px] rounded border border-transparent bg-transparent text-center text-[11px] font-medium tabular-nums text-zinc-800 placeholder:text-zinc-300 hover:border-zinc-200 focus:border-emerald-600 focus:bg-white disabled:cursor-not-allowed disabled:text-zinc-500" /></td>)}
              <td className="border-r border-zinc-100 px-2 text-center text-[11px] font-semibold tabular-nums">{rowTotal ? rowTotal.toFixed(2) : "—"}</td>
              <td className="px-2"><input aria-label={`Work summary for ${client.name}`} disabled={locked} value={row.note} onChange={(event) => { updateRows((current) => current.map((item) => item.id === row.id ? { ...item, note: event.target.value } : item)); setSaved(false); }} placeholder="Add a brief work summary…" className="h-8 w-full truncate rounded border border-transparent bg-transparent px-1.5 text-[10px] text-zinc-700 placeholder:text-zinc-300 hover:border-zinc-200 focus:border-emerald-600 focus:bg-white disabled:cursor-not-allowed" /></td>
            </tr>;
          })}{!rows.length && <tr><td colSpan={9} className="py-14 text-center"><CalendarDays className="mx-auto text-zinc-300" size={22} /><p className="mt-2 text-xs font-medium text-zinc-800">No entries for this week</p><p className="mt-1 text-[10px] text-zinc-500">Add an engagement row to start logging time.</p></td></tr>}</tbody>
          <tfoot><tr className="bg-zinc-50 font-semibold"><td className="sticky left-0 border-r border-t border-zinc-200 bg-zinc-50 px-3 py-3 text-[10px]">Daily total</td>{dayTotals.map((total, index) => <td key={index} className="border-r border-t border-zinc-200 px-2 py-3 text-center text-[11px] tabular-nums">{total ? total.toFixed(2) : "—"}</td>)}<td className="border-r border-t border-zinc-200 px-2 py-3 text-center text-[11px] tabular-nums">{weekTotal.toFixed(2)}</td><td className="border-t border-zinc-200 px-3 py-3 text-[9px] font-normal text-zinc-500">Weekly capacity 45.00 h</td></tr></tfoot>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 bg-white px-4 py-3"><p aria-live="polite" className="text-[10px] text-zinc-500">{saved ? "Draft saved just now." : `${rows.length} engagement rows · Changes are saved locally in this demo.`}</p><div className="flex items-center gap-2"><Button onClick={() => { updateRows((current) => current.map((row) => ({ ...row, status: "Draft" }))); setSaved(true); }} disabled={locked}><Save size={13} /> Save draft</Button><Button variant="primary" onClick={() => updateRows((current) => current.map((row) => ({ ...row, status: "Submitted" })))} disabled={locked}><Send size={13} /> Submit week to head</Button></div></div>
    </section>
    <Modal open={addOpen} onOpenChange={setAddOpen} title="Add engagement row" description="Choose a client assignment and Pakistan task code.">
      <div className="space-y-4 p-5"><label className="block text-[11px] font-medium text-zinc-700">Client<select className="mt-1.5 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs" value={newClient} onChange={(event) => { setNewClient(event.target.value); const next = engagementList.find((item) => item.clientId === event.target.value); if (next) setNewEngagement(next.id); }}><option value="" disabled>Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
        <label className="block text-[11px] font-medium text-zinc-700">Engagement<select className="mt-1.5 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs" value={newEngagement} onChange={(event) => setNewEngagement(event.target.value)}>{engagementList.filter((item) => item.clientId === newClient).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="block text-[11px] font-medium text-zinc-700">Pakistan task code<select className="mt-1.5 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs" value={newCode} onChange={(event) => setNewCode(event.target.value)}>{taskCodes.map((code) => <option key={code}>{code}</option>)}</select></label>
        <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4"><Button onClick={() => setAddOpen(false)}>Cancel</Button><Button variant="primary" onClick={addRow}><Plus size={13} /> Add row</Button></div>
      </div>
    </Modal>
  </>;
}
