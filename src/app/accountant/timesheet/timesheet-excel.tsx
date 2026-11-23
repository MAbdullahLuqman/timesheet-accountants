"use client";

import { useState, type DragEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button, Modal } from "@/components/ui";
import { useAppState } from "@/lib/portal-state";
import { getTimeEntryLabels, importTimeEntries } from "@/lib/supabase/time-entry-labels";
import type { TimeEntryInput } from "@/lib/supabase/actions";
import { normalizeTimeEntryLabel as normalized } from "@/lib/time-entry-label";

type Entry = TimeEntryInput & { status: string };
type PreviewRow = TimeEntryInput & { company_name: string };
const text = (value: unknown) => String(value ?? "").trim();
const dateValue = (value: unknown, XLSX: typeof import("xlsx")) => {
  if (typeof value === "number") { const d = XLSX.SSF.parse_date_code(value); return d ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}` : ""; }
  const raw = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  return match ? `${match[3].length === 2 ? "20" + match[3] : match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : "";
};
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export default function TimesheetExcel({ rows, start, end, busy, dirty }: { rows: Entry[]; start: string; end: string; busy: boolean; dirty: boolean }) {
  const { activeEngagements, weekStart, shiftWeek, profile } = useAppState();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [newCompanies, setNewCompanies] = useState<string[]>([]);
  const [newTasks, setNewTasks] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function parse(source: File) {
    setPreview([]); setErrors([]); setMessage("");
    if (!/\.(xlsx|xls)$/i.test(source.name) || source.size > 5_000_000) { setMessage("Choose an .xlsx or .xls file under 5 MB."); return; }
    try {
      const labels = await getTimeEntryLabels();
      if ("error" in labels) { setMessage(labels.error); return; }
      const companies = new Map(labels.data.filter((label) => label.kind === "company").map((label) => [label.normalized_key, label.display_name]));
      const tasks = new Map(labels.data.filter((label) => label.kind === "task").map((label) => [label.normalized_key, label.display_name]));
      const addedCompanies: string[] = [], addedTasks: string[] = [];
      const XLSX = await import("xlsx");
      const book = XLSX.read(await source.arrayBuffer(), { type: "array" });
      const parsed: PreviewRow[] = [], issues: string[] = [];
      for (const sheetName of book.SheetNames) {
        const data = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheetName], { header: 1, defval: "" });
        const header = data.findIndex((line) => { const keys = line.map((value) => text(value).toLowerCase().replace(/\s+/g, " ")); return keys.includes("date") && keys.some((value) => /^(logged )?hours$/.test(value)); });
        if (header < 0) continue;
        const keys = data[header].map((value) => text(value).toLowerCase().replace(/\s+/g, " "));
        const index = (pattern: RegExp) => keys.findIndex((value) => pattern.test(value));
        const d = index(/^date$/), e = index(/^(engagement|client|client\s*\/\s*(engagement|location))$/), t = index(/^(task|task code|work type|engagement\s*\/\s*task)$/), h = index(/^(logged )?hours$/), b = index(/^billable$/), n = index(/^(notes|description|narration|work description\s*\/\s*narration)$/);
        if (e < 0 || t < 0) { issues.push(`${sheetName}: include Client / Location and Engagement / Task columns.`); continue; }
        for (let i = header + 1; i < data.length; i++) {
          const line = data[i];
          if (!line.some((value) => text(value))) continue;
          if (line.some((value) => /^(total(?: weekly)? hours|billable hours|non-billable hours|total|prepared by|verified by|approved by)\b/i.test(text(value)))) continue;
          const work_date = dateValue(line[d], XLSX);
          const sourceClient = text(line[e]), sourceTask = text(line[t]);
          const logged_hours = Number(text(line[h]).replace(/,/g, ""));
          const billable = b < 0 || !["no", "false", "0", "n"].includes(text(line[b]).toLowerCase());
          const notes = n < 0 ? "" : text(line[n]);
          if (!validDate(work_date) || !normalized(sourceClient) || !normalized(sourceTask) || sourceClient.length > 200 || sourceTask.length > 150 || !Number.isFinite(logged_hours) || logged_hours <= 0 || logged_hours > 24 || logged_hours * 4 % 1 !== 0 || notes.length > 1000) { issues.push(`${sheetName} row ${i + 1}: check date, company, task, quarter-hour value, or notes length.`); continue; }
          const companyKey = normalized(sourceClient), taskKey = normalized(sourceTask);
          if (!companies.has(companyKey)) { companies.set(companyKey, sourceClient); addedCompanies.push(sourceClient); }
          if (!tasks.has(taskKey)) { tasks.set(taskKey, sourceTask); addedTasks.push(sourceTask); }
          parsed.push({ id: crypto.randomUUID(), engagement_id: null, company_name: companies.get(companyKey)!, task_code: tasks.get(taskKey)!, work_date, logged_hours, billable, notes });
        }
      }
      setPreview(parsed); setNewCompanies(addedCompanies); setNewTasks(addedTasks);
      setSelected(new Set([...addedCompanies.map((name) => `company:${normalized(name)}`), ...addedTasks.map((name) => `task:${normalized(name)}`)]));
      setErrors(issues.slice(0, 10));
      if (!parsed.length && !issues.length) setMessage("No timesheet table found. Use Date, Client / Location, Engagement / Task, Work Description / Narration, Billable, and Hours headers.");
      if (parsed.length > 200) setMessage("Import at most 200 rows at a time.");
    } catch { setMessage("Could not read this Excel file."); }
  }

  async function importRows() {
    setSaving(true); setMessage("");
    try {
      const result = await importTimeEntries(preview, {
        company: newCompanies.filter((name) => selected.has(`company:${normalized(name)}`)),
        task: newTasks.filter((name) => selected.has(`task:${normalized(name)}`)),
      });
      if ("error" in result) { setMessage(result.error); return; }
      const first = new Date(`${preview[0].work_date}T12:00:00`);
      first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
      const weeks = Math.round((first.getTime() - weekStart.getTime()) / 604800000);
      if (weeks) shiftWeek(weeks);
      await queryClient.invalidateQueries({ queryKey: ["timesheet-week", profile.id] });
      router.refresh(); setOpen(false); setPreview([]);
    } catch { setMessage("Could not import timesheet. Try again."); }
    finally { setSaving(false); }
  }

  async function exportSheet() {
    const XLSX = await import("xlsx");
    const data: (string | number)[][] = [["TIMESHEET"], ["Week", `${start} to ${end}`], ["Prepared By", profile.full_name], [], ["Date", "Company / Engagement", "Task", "Hours", "Billable", "Notes", "Status"]];
    for (const row of rows) { const engagement = activeEngagements.find((item) => item.id === row.engagement_id); data.push([row.work_date, row.company_name || (engagement ? `${engagement.client_name} · ${engagement.title}` : row.engagement_id ?? ""), row.task_code, Number(row.logged_hours), row.billable ? "Yes" : "No", row.notes, row.status]); }
    data.push([], ["", "", "Total Hours", rows.reduce((sum, row) => sum + Number(row.logged_hours), 0)]);
    const sheet = XLSX.utils.aoa_to_sheet(data);
    sheet["!cols"] = [{ wch: 14 }, { wch: 36 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 50 }, { wch: 14 }];
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Timesheet"); XLSX.writeFile(book, `timesheet-${start}.xlsx`);
  }
  const drop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); const source = event.dataTransfer.files[0]; if (source) void parse(source); };
  const category = (kind: "company" | "task", name: string) => {
    const id = `${kind}:${normalized(name)}`;
    return <label key={id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selected.has(id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(id); else next.delete(id); return next; })} />Add {name} to shared {kind === "company" ? "companies" : "tasks"}</label>;
  };
  return <><Button disabled={busy || dirty} onClick={() => { setPreview([]); setErrors([]); setMessage(""); setOpen(true); }}>Import Excel (.xlsx)</Button><Button disabled={busy || dirty} onClick={() => void exportSheet()}>Download Excel (.xlsx)</Button><Modal open={open} onOpenChange={setOpen} title="Import timesheet" description="Company and task names are matched automatically. New names can be added to the shared lists." className="!w-[min(860px,calc(100vw-32px))]"><div className="space-y-3 p-5"><div onDragOver={(event) => event.preventDefault()} onDrop={drop} className="rounded border-2 border-dashed border-zinc-300 p-5 text-center text-xs">Drop an Excel file here<input type="file" aria-label="Choose timesheet Excel file" accept=".xlsx,.xls" onChange={(event) => { const next = event.target.files?.[0]; if (next) void parse(next); }} className="mt-2 max-w-full" /></div>{message && <p role="alert" className="text-xs text-rose-700">{message}</p>}{errors.length > 0 && <div role="alert" className="max-h-24 overflow-auto text-xs text-rose-700">{errors.map((error) => <p key={error}>{error}</p>)}</div>}<p className="text-xs">{preview.length} rows · {preview.reduce((sum, row) => sum + row.logged_hours, 0).toFixed(2)} hours</p>{(newCompanies.length > 0 || newTasks.length > 0) && <div className="grid gap-3 rounded border p-3 sm:grid-cols-2"><div><p className="mb-2 text-xs font-semibold">New companies</p>{newCompanies.map((name) => category("company", name))}</div><div><p className="mb-2 text-xs font-semibold">New tasks</p>{newTasks.map((name) => category("task", name))}</div></div>}<div className="max-h-72 overflow-auto"><table className="w-full min-w-[540px] text-left text-xs"><thead><tr><th className="p-1">Date / hours</th><th className="p-1">Company</th><th className="p-1">Sheet task</th></tr></thead><tbody>{preview.map((row) => <tr key={row.id} className="border-t"><td className="p-1">{row.work_date}<br />{row.logged_hours}h</td><td className="p-1">{row.company_name}</td><td className="p-1">{row.task_code}</td></tr>)}</tbody></table></div><Button variant="primary" disabled={saving || !!errors.length || !preview.length || preview.length > 200} onClick={() => void importRows()}>Import All Rows to Draft</Button></div></Modal></>;
}
