"use client";

import { useState, type DragEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button, Modal } from "@/components/ui";
import { useAppState } from "@/lib/portal-state";
import { saveTimeEntries, type TimeEntryInput } from "@/lib/supabase/actions";

type Entry = TimeEntryInput & { status: string };
type PreviewRow = TimeEntryInput & { sourceClient: string; sourceTask: string };
const taskCodes = ["FBR Income Tax / IRIS", "Sales Tax / SRB / PRA", "WHT Reconciliation", "Statutory Audit", "SECP Filing", "Bookkeeping", "Exam Leave / Admin"];
const text = (value: unknown) => String(value ?? "").trim();
const normalized = (value: unknown) => text(value).toLowerCase().replace(/\s+/g, " ");
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
  const [fallback, setFallback] = useState("");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const unmapped = preview.filter((row) => !row.engagement_id || !row.task_code).length;
  const taskFrom = (value: string) => taskCodes.find((item) => normalized(item) === normalized(value)) ?? (
    /sales tax/i.test(value) ? "Sales Tax / SRB / PRA" :
    /secp|form.?29|form.?a/i.test(value) ? "SECP Filing" :
    /income tax|fbr|sec 177|iris/i.test(value) ? "FBR Income Tax / IRIS" :
    /wht|withholding/i.test(value) ? "WHT Reconciliation" :
    /statutory audit|inventory valuation|vouching/i.test(value) ? "Statutory Audit" :
    /bookkeeping|ledger/i.test(value) ? "Bookkeeping" :
    /internal|staff planning|admin|exam leave/i.test(value) ? "Exam Leave / Admin" : ""
  );
  async function parse(source: File, fallbackId: string) {
    setPreview([]); setErrors([]); setMessage("");
    if (!/\.(xlsx|xls)$/i.test(source.name) || source.size > 5_000_000) { setMessage("Choose an .xlsx or .xls file under 5 MB."); return; }
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await source.arrayBuffer(), { type: "array" });
      const parsed: PreviewRow[] = [], issues: string[] = [];
      for (const sheetName of book.SheetNames) {
        const data = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheetName], { header: 1, defval: "" });
        const header = data.findIndex((line) => { const keys = line.map(normalized); return keys.includes("date") && keys.some((key) => /^(logged )?hours$/.test(key)); });
        if (header < 0) continue;
        const keys = data[header].map(normalized);
        const index = (pattern: RegExp) => keys.findIndex((key) => pattern.test(key));
        const d = index(/^date$/), e = index(/^(engagement|client|client\s*\/\s*(engagement|location))$/), t = index(/^(task|task code|work type|engagement\s*\/\s*task)$/), h = index(/^(logged )?hours$/), b = index(/^billable$/), n = index(/^(notes|description|narration|work description\s*\/\s*narration)$/);
        for (let i = header + 1; i < data.length; i++) {
          const line = data[i];
          if (!line.some((value) => text(value))) continue;
          if (line.some((value) => /^(total(?: weekly)? hours|billable hours|non-billable hours|total|prepared by|verified by|approved by)\b/i.test(text(value)))) continue;
          const work_date = dateValue(line[d], XLSX);
          const sourceClient = e < 0 ? "" : text(line[e]);
          const sourceTask = t < 0 ? "" : text(line[t]);
          const matches = sourceClient ? activeEngagements.filter((item) => [item.id.toLowerCase(), normalized(item.client_name), normalized(item.title), normalized(`${item.client_name} · ${item.title}`)].includes(normalized(sourceClient))) : [];
          const engagement_id = matches.length === 1 ? matches[0].id : fallbackId;
          const task_code = taskFrom(sourceTask);
          const logged_hours = Number(text(line[h]).replace(/,/g, ""));
          const billableValue = b < 0 ? "yes" : normalized(line[b]);
          const billable = !["no", "false", "0", "n"].includes(billableValue);
          const notes = n < 0 ? "" : text(line[n]);
          if (!validDate(work_date) || !Number.isFinite(logged_hours) || logged_hours <= 0 || logged_hours > 24 || logged_hours * 4 % 1 !== 0 || notes.length > 1000) { issues.push(`${sheetName} row ${i + 1}: check date, quarter-hour value, or notes length.`); continue; }
          parsed.push({ id: crypto.randomUUID(), engagement_id, task_code, work_date, logged_hours, billable, notes, sourceClient, sourceTask });
        }
      }
      setPreview(parsed); setErrors(issues.slice(0, 10));
      if (!parsed.length && !issues.length) setMessage("No timesheet table found. Use Date, Client / Location, Engagement / Task, Work Description / Narration, Billable, and Hours headers.");
      if (parsed.length > 200) setMessage("Import at most 200 rows at a time.");
    } catch { setMessage("Could not read this Excel file."); }
  }
  async function importRows() {
    setSaving(true); setMessage("");
    try {
      const result = await saveTimeEntries(preview.map(({ sourceClient: _sourceClient, sourceTask: _sourceTask, ...row }) => row));
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
    const data: (string | number)[][] = [["TIMESHEET"], ["Week", `${start} to ${end}`], ["Prepared By", profile.full_name], [], ["Date", "Engagement", "Task", "Hours", "Billable", "Notes", "Status"]];
    for (const row of rows) { const engagement = activeEngagements.find((item) => item.id === row.engagement_id); data.push([row.work_date, engagement ? `${engagement.client_name} · ${engagement.title}` : row.engagement_id, row.task_code, Number(row.logged_hours), row.billable ? "Yes" : "No", row.notes, row.status]); }
    data.push([], ["", "", "Total Hours", rows.reduce((sum, row) => sum + Number(row.logged_hours), 0)]);
    const sheet = XLSX.utils.aoa_to_sheet(data);
    sheet["!cols"] = [{ wch: 14 }, { wch: 36 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 50 }, { wch: 14 }];
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Timesheet"); XLSX.writeFile(book, `timesheet-${start}.xlsx`);
  }
  const drop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); const source = event.dataTransfer.files[0]; if (source) void parse(source, fallback); };
  return <><Button disabled={busy || dirty} onClick={() => { setFallback(""); setPreview([]); setErrors([]); setMessage(""); setOpen(true); }}>Import Excel (.xlsx)</Button><Button disabled={busy || dirty} onClick={() => void exportSheet()}>Download Excel (.xlsx)</Button><Modal open={open} onOpenChange={setOpen} title="Import timesheet" description="Review each row and map its client and task before saving drafts." className="!w-[min(860px,calc(100vw-32px))]"><div className="space-y-3 p-5"><div onDragOver={(event) => event.preventDefault()} onDrop={drop} className="rounded border-2 border-dashed border-zinc-300 p-5 text-center text-xs">Drop an Excel file here<input type="file" aria-label="Choose timesheet Excel file" accept=".xlsx,.xls" onChange={(event) => { const next = event.target.files?.[0]; if (next) void parse(next, fallback); }} className="mt-2 max-w-full" /></div><label className="block text-xs">Use this engagement for unmatched clients<select value={fallback} onChange={(event) => { setFallback(event.target.value); if (event.target.value) setPreview((current) => current.map((row) => row.engagement_id ? row : { ...row, engagement_id: event.target.value })); }} className="field-select mt-1"><option value="">Map each row below</option>{activeEngagements.map((item) => <option key={item.id} value={item.id}>{item.client_name} · {item.title}</option>)}</select></label>{message && <p role="alert" className="text-xs text-rose-700">{message}</p>}{errors.length > 0 && <div role="alert" className="max-h-24 overflow-auto text-xs text-rose-700">{errors.map((error) => <p key={error}>{error}</p>)}</div>}<p className="text-xs">{preview.length} rows · {preview.reduce((sum, row) => sum + row.logged_hours, 0).toFixed(2)} hours · {unmapped} need mapping</p><div className="max-h-72 overflow-auto"><table className="w-full min-w-[540px] text-left text-xs"><thead><tr><th className="p-1">Date / hours</th><th className="p-1">Client → active engagement</th><th className="p-1">Sheet task → task code</th></tr></thead><tbody>{preview.map((row) => <tr key={row.id} className="border-t"><td className="p-1">{row.work_date}<br />{row.logged_hours}h</td><td className="p-1"><span className="block">{row.sourceClient || "No client on sheet"}</span><select aria-label={`Engagement for ${row.sourceClient || row.work_date}`} value={row.engagement_id} onChange={(event) => setPreview((current) => current.map((item) => item.id === row.id ? { ...item, engagement_id: event.target.value } : item))} className="field-select !mt-1"><option value="">Choose engagement</option>{activeEngagements.map((item) => <option key={item.id} value={item.id}>{item.client_name} · {item.title}</option>)}</select></td><td className="p-1"><span className="block">{row.sourceTask || "No task on sheet"}</span><select aria-label={`Task code for ${row.sourceTask || row.work_date}`} value={row.task_code} onChange={(event) => setPreview((current) => current.map((item) => item.id === row.id ? { ...item, task_code: event.target.value } : item))} className="field-select !mt-1"><option value="">Choose task code</option>{taskCodes.map((item) => <option key={item}>{item}</option>)}</select></td></tr>)}</tbody></table></div><Button variant="primary" disabled={saving || !!errors.length || !!unmapped || !preview.length || preview.length > 200} onClick={() => void importRows()}>Import All Rows to Draft</Button></div></Modal></>;
}
