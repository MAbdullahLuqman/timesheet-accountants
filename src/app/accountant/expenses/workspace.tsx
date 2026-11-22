"use client";

import { useEffect, useState, useTransition, type FormEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, PageHeading, Badge } from "@/components/ui";
import { formatPKR } from "@/lib/format";
import { addExpenses, submitExpenseMonth, type ExpenseInput } from "@/lib/supabase/expense-actions";

type Row = ExpenseInput & { id: string; status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED"; review_comment: string | null };
type Engagement = { id: string; client_name: string; title: string };
const todayMonth = () => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
const cell = (value: unknown) => String(value ?? "").trim();
const dateCell = (value: unknown, XLSX: typeof import("xlsx")) => {
  if (typeof value === "number") { const date = XLSX.SSF.parse_date_code(value); return date ? `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}` : ""; }
  const raw = cell(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  return match ? `${match[3].length === 2 ? "20" + match[3] : match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : "";
};

export default function Expenses({ rows, engagements, name, error }: { rows: Row[]; engagements: Engagement[]; name: string; error?: string }) {
  const router = useRouter();
  const [month, setMonth] = useState(() => rows.find((row) => row.expense_date.startsWith(todayMonth()))?.expense_date.slice(0, 7) ?? rows[0]?.expense_date.slice(0, 7) ?? todayMonth());
  useEffect(() => { const saved = new URLSearchParams(window.location.search).get("month"); if (saved && /^\d{4}-(0[1-9]|1[0-2])$/.test(saved)) setMonth(saved); }, []);
  const selectMonth = (value: string) => { setMonth(value); const url = new URL(window.location.href); url.searchParams.set("month", value); window.history.replaceState(window.history.state, "", url); };
  const [preview, setPreview] = useState<ExpenseInput[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [notice, setNotice] = useState(error ?? "");
  const [pending, startTransition] = useTransition();
  const visible = rows.filter((row) => row.expense_date.startsWith(month));
  const total = visible.reduce((sum, row) => sum + Number(row.amount_pkr), 0);
  const approved = visible.filter((row) => row.status === "APPROVED").reduce((sum, row) => sum + Number(row.amount_pkr), 0);
  const review = visible.filter((row) => row.status === "SUBMITTED").reduce((sum, row) => sum + Number(row.amount_pkr), 0);
  const submit = (task: () => Promise<{ error?: string; success?: boolean }>, onSuccess?: () => void) => startTransition(async () => { const result = await task(); setNotice(result.error ?? "Saved."); if (result.success) { onSuccess?.(); router.refresh(); } });
  function quickAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    submit(() => addExpenses([{ expense_date: cell(values.get("date")), location_client: cell(values.get("location")), reason: cell(values.get("reason")), amount_pkr: Number(values.get("amount")), engagement_id: cell(values.get("engagement")) || null, billable_to_client: values.has("billable") }]), () => form.reset());
  }
  async function load(file?: File) {
    if (!file) return;
    if (file.size > 5_000_000) { setNotice("Excel file must be under 5 MB."); return; }
    if (!/\.(xlsx|xls)$/i.test(file.name)) { setNotice("Choose an .xlsx or .xls file."); return; }
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
      const parsed: ExpenseInput[] = [];
      for (const sheet of book.SheetNames) {
        const table = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheet], { header: 1, defval: "" });
        const headerIndex = table.findIndex((line) => { const cells = line.map((v) => cell(v).toLowerCase()); return cells.some((v) => v === "date") && cells.some((v) => /^(location|location\s*\/\s*client|client)$/.test(v)) && cells.some((v) => v === "reason") && cells.some((v) => v === "amount" || v.startsWith("amount ")); });
        if (headerIndex < 0) continue;
        const headers = table[headerIndex].map((v) => cell(v).toLowerCase());
        const index = (pattern: RegExp) => headers.findIndex((v) => pattern.test(v));
        const d = index(/^date$/), l = index(/^(location|location\s*\/\s*client|client)$/), r = index(/^reason$/), a = index(/^amount(?:\s|$)/);
        for (const line of table.slice(headerIndex + 1)) {
          if (line.some((v) => /^(total|prepared by|verified by|approved by)\b/i.test(cell(v)))) continue;
          const expense_date = dateCell(line[d], XLSX);
          const location_client = cell(line[l]), reason = cell(line[r]);
          const amount_pkr = Number(cell(line[a]).replace(/[,₨\s]/g, ""));
          if (expense_date && location_client && reason && Number.isFinite(amount_pkr) && amount_pkr > 0) parsed.push({ expense_date, location_client, reason, amount_pkr, billable_to_client: false });
        }
      }
      setPreview(parsed.length > 500 ? [] : parsed); setNotice(parsed.length > 500 ? "Import up to 500 rows at a time." : parsed.length ? "" : "No valid expense rows found. Check the Date, Location/Client, Reason, and Amount headers.");
    } catch { setNotice("Could not read this Excel sheet."); }
  }
  const drop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); void load(event.dataTransfer.files[0]); };
  async function exportSheet() {
    const XLSX = await import("xlsx");
    const data: (string | number)[][] = [["TRAVELLING SHEET"], ["Month", month], [], ["S No.", "Date", "Location/Client", "Reason", "Amount"]];
    visible.forEach((row, i) => data.push([i + 1, row.expense_date, row.location_client, row.reason, Number(row.amount_pkr)]));
    data.push([], ["", "", "", "Total", total], [], ["Prepared By", name], ["Verified By", ""], ["Approved By", ""]);
    const sheet = XLSX.utils.aoa_to_sheet(data);
    sheet["!cols"] = [{ wch: 8 }, { wch: 14 }, { wch: 32 }, { wch: 42 }, { wch: 18 }];
    sheet["!autofilter"] = { ref: `A4:E${Math.max(4, visible.length + 4)}` };
    for (let n = 5; n <= visible.length + 5; n++) if (sheet[`E${n}`]) sheet[`E${n}`].z = '"PKR" #,##0.00';
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Travelling Sheet"); XLSX.writeFile(book, `travelling-sheet-${month}.xlsx`);
  }
  return <>
    <PageHeading title="Travelling & Expenses" subtitle="Prepare and submit your monthly claim." actions={<><Button onClick={() => setImportOpen(true)}>Import Excel Sheet (.xlsx)</Button><Button onClick={() => void exportSheet()}>Download Excel (.xlsx)</Button></>} />
    <label className="mb-4 block text-xs font-medium">Claim month <input aria-label="Claim month" type="month" value={month} onChange={(e) => selectMonth(e.target.value)} className="field-input mt-1 max-w-48" /></label>
    {notice && <p role="status" className="mb-4 rounded border border-zinc-200 bg-white p-3 text-xs">{notice}</p>}
    <div className="mb-5 grid gap-3 sm:grid-cols-3">{[["Total Claimed", total], ["Approved Payout", approved], ["Pending Review", review]].map(([label, value]) => <div key={label} className="rounded-lg border border-zinc-200 bg-white p-4"><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 text-xl font-semibold">{formatPKR(Number(value))}</p></div>)}</div>
    <form onSubmit={quickAdd} className="mb-5 rounded-lg border border-zinc-200 bg-white p-4"><h2 className="mb-3 text-sm font-semibold">Quick add expense</h2><div className="grid gap-3 md:grid-cols-5"><label className="text-xs">Date<input key={month} name="date" type="date" required defaultValue={`${month}-01`} className="field-input mt-1" /></label><label className="text-xs">Location / Client<input name="location" required maxLength={250} className="field-input mt-1" /></label><label className="text-xs">Reason<input name="reason" required maxLength={500} className="field-input mt-1" /></label><label className="text-xs">Amount (PKR)<input name="amount" type="number" min="0.01" step="0.01" required className="field-input mt-1" /></label><label className="text-xs">Active engagement<select name="engagement" className="field-select mt-1"><option value="">None</option>{engagements.map((e) => <option key={e.id} value={e.id}>{e.client_name} · {e.title}</option>)}</select></label></div><div className="mt-3 flex items-center justify-between"><label className="text-xs"><input name="billable" type="checkbox" className="mr-2" />Billable to Client</label><Button type="submit" variant="primary" disabled={pending}>Add draft row</Button></div></form>
    <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Claim rows</h2><Button variant="primary" disabled={pending || !visible.some((r) => r.status === "DRAFT" || r.status === "REJECTED")} onClick={() => submit(() => submitExpenseMonth(month))}>Submit Month Claim</Button></div>
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white"><table className="w-full min-w-[700px] text-left text-xs"><thead className="bg-zinc-50"><tr>{["Date", "Location / Client", "Reason", "Amount", "Billable", "Status"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{visible.map((r) => <tr key={r.id} className="border-t border-zinc-100"><td className="p-3">{r.expense_date}</td><td className="p-3">{r.location_client}</td><td className="p-3">{r.reason}</td><td className="p-3">{formatPKR(Number(r.amount_pkr))}</td><td className="p-3">{r.billable_to_client ? "Yes" : "No"}</td><td className="p-3"><Badge tone={r.status === "APPROVED" ? "green" : r.status === "REJECTED" ? "rose" : "amber"}>{r.status}</Badge>{r.review_comment && <p className="mt-1 text-rose-700">{r.review_comment}</p>}</td></tr>)}{!visible.length && <tr><td colSpan={6} className="p-8 text-center text-zinc-500">No expenses for this month.</td></tr>}</tbody></table></div>
    <Modal open={importOpen} onOpenChange={setImportOpen} title="Import Excel Sheet" description="Choose or drop an .xlsx or .xls travelling sheet."><div className="space-y-4 p-5"><div onDragOver={(e) => e.preventDefault()} onDrop={drop} className="rounded-lg border-2 border-dashed border-zinc-300 p-6 text-center text-xs"><p>Drop an Excel file here</p><input aria-label="Choose Excel file" type="file" accept=".xlsx,.xls" onChange={(e) => void load(e.target.files?.[0])} className="mt-3 max-w-full" /></div><p className="text-xs">{preview.length} rows · {formatPKR(preview.reduce((sum, r) => sum + r.amount_pkr, 0))}</p><div className="max-h-60 overflow-auto"><table className="w-full text-left text-xs"><tbody>{preview.map((r, i) => <tr key={i} className="border-t"><td className="p-2">{r.expense_date}</td><td className="p-2">{r.location_client}</td><td className="p-2">{r.reason}</td><td className="p-2">{formatPKR(r.amount_pkr)}</td></tr>)}</tbody></table></div><Button variant="primary" disabled={pending || !preview.length} onClick={() => submit(() => addExpenses(preview), () => { selectMonth(preview[0].expense_date.slice(0, 7)); setPreview([]); setImportOpen(false); })}>Import All Rows to Draft</Button></div></Modal>
  </>;
}
