"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type SortingState } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, KeyRound, Plus, Search, Shield, Users } from "lucide-react";
import { Avatar, Badge, Button, Modal, PageHeading } from "@/components/ui";
import { createStaffUser, resetStaffPassword, toggleUserActiveStatus } from "./action";
import { formatPKR } from "@/lib/format";

type Person = { id: string; department_id: string | null; full_name: string; email: string; role: "PARTNER" | "HEAD" | "STAFF"; is_active: boolean; cost_rate_pkr: number; bill_rate_pkr: number; weekly_target_hrs: number; department_name: string };
type Department = { id: string; name: string; firm_id: string };
const column = createColumnHelper<Person>();

export default function TeamAdmin({ people, departments }: { people: Person[]; departments: Department[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "full_name", desc: false }]);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetPerson, setResetPerson] = useState<Person | null>(null);
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const rows = useMemo(() => people.filter((person) => `${person.full_name} ${person.email} ${person.role} ${person.department_name}`.toLowerCase().includes(search.toLowerCase())), [people, search]);
  const act = (task: () => Promise<{ error?: string; success?: boolean }>, success: string) => startTransition(async () => { const result = await task(); setNotice(result.error ?? success); if (result.success) router.refresh(); });
  const columns = useMemo(() => [
    column.accessor("full_name", { header: "Team member", cell: ({ row, getValue }) => <div className="flex items-center gap-2.5"><Avatar name={getValue()} /><div><p className="text-[10px] font-medium">{getValue()}</p><p className="text-[9px] text-zinc-500">{row.original.email}</p></div></div> }),
    column.accessor("role", { header: "Role", cell: ({ getValue }) => <Badge>{getValue()}</Badge> }),
    column.accessor("department_name", { header: "Department" }),
    column.accessor("cost_rate_pkr", { header: "Cost / hour", cell: ({ getValue }) => <span className="tabular-nums">{formatPKR(Number(getValue()))}</span> }),
    column.accessor("bill_rate_pkr", { header: "Billing / hour", cell: ({ getValue }) => <span className="tabular-nums">{formatPKR(Number(getValue()))}</span> }),
    column.accessor("weekly_target_hrs", { header: "Weekly target", cell: ({ getValue }) => <span className="tabular-nums">{Number(getValue()).toFixed(1)}h</span> }),
    column.accessor("is_active", { header: "Access", cell: ({ row, getValue }) => <div className="flex items-center gap-2"><Badge tone={getValue() ? "green" : "rose"}>{getValue() ? "Active" : "Deactivated"}</Badge><Button disabled={pending} onClick={() => act(() => toggleUserActiveStatus(row.original.id, !getValue()), getValue() ? "Account deactivated." : "Account activated.")}>{getValue() ? "Deactivate" : "Activate"}</Button><Button variant="ghost" aria-label={`Reset password for ${row.original.full_name}`} onClick={() => setResetPerson(row.original)}><KeyRound size={13} /></Button></div> }),
  ], [pending]);
  const table = useReactTable({ data: rows, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createStaffUser(form);
      setNotice(result.error ?? "User account created.");
      if (!("error" in result)) { setCreateOpen(false); router.refresh(); }
    });
  }
  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetPerson) return;
    const password = String(new FormData(event.currentTarget).get("new_password") ?? "");
    const person = resetPerson;
    startTransition(async () => {
      const result = await resetStaffPassword(person.id, password);
      setNotice(result.error ?? "Password reset.");
      if (!("error" in result)) { setResetPerson(null); router.refresh(); }
    });
  }

  return <>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2.5"><div className="flex items-center gap-2"><Users size={14} className="text-zinc-500" /><p className="text-[10px] font-medium">{rows.length} firm users</p><Badge tone="blue"><Shield size={11} className="mr-1" />Partner admin</Badge></div><div className="flex gap-2"><label className="flex h-9 items-center gap-2 rounded-md border border-zinc-200 px-2.5 text-zinc-400"><Search size={13} /><input aria-label="Search team members" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, role" className="w-40 border-0 bg-transparent text-[10px] outline-none" /></label><Button variant="primary" onClick={() => setCreateOpen(true)}><Plus size={14} /> Create user ID</Button></div></div>
    {notice && <p role="status" className="mb-3 text-xs text-emerald-800">{notice}</p>}
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white"><div className="table-scroll"><table className="w-full min-w-[1000px] border-collapse text-left"><thead className="bg-zinc-50">{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id} className="border-b border-zinc-200 px-3 py-2.5 text-[9px] font-semibold uppercase tracking-wide text-zinc-500"><button onClick={header.column.getToggleSortingHandler()} className="inline-flex items-center gap-1">{flexRender(header.column.columnDef.header, header.getContext())}{header.column.getIsSorted() === "asc" ? <ArrowUp size={10} /> : header.column.getIsSorted() === "desc" ? <ArrowDown size={10} /> : null}</button></th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map((row) => <tr key={row.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60">{row.getVisibleCells().map((cell) => <td key={cell.id} className="px-3 py-2.5 text-[10px]">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}{!rows.length && <tr><td colSpan={7} className="py-12 text-center text-xs text-zinc-500">No users match your search.</td></tr>}</tbody></table></div></section>
    <Modal open={createOpen} onOpenChange={setCreateOpen} title="Create user ID" description="Add a firm login and assign the user’s role, department, and rates."><form onSubmit={submitCreate} className="space-y-3 p-5"><Field label="Full name"><input name="full_name" required className="field-input" autoComplete="name" /></Field><Field label="Email / Gmail"><input name="email" type="email" required className="field-input" autoComplete="email" /></Field><Field label="Temporary password · minimum 8 characters"><input name="password" type="password" minLength={8} required className="field-input" autoComplete="new-password" /></Field><div className="grid grid-cols-2 gap-3"><Field label="Role"><select name="role" className="field-select"><option value="STAFF">STAFF</option><option value="HEAD">HEAD</option><option value="PARTNER">PARTNER</option></select></Field><Field label="Department"><select name="department_id" className="field-select" defaultValue=""><option value="">None / Partner</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></Field></div><div className="grid grid-cols-2 gap-3"><Field label="Cost rate · PKR / hour"><input name="cost_rate_pkr" type="number" min="0" step="1" defaultValue="0" required className="field-input" /></Field><Field label="Billing rate · PKR / hour"><input name="bill_rate_pkr" type="number" min="0" step="1" defaultValue="0" required className="field-input" /></Field></div><p className="text-[10px] text-zinc-500">Weekly target defaults to 45 hours.</p><div className="flex justify-end gap-2 border-t border-zinc-100 pt-3"><Button type="button" onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={pending}>Create account</Button></div></form></Modal>
    <Modal open={!!resetPerson} onOpenChange={(open) => !open && setResetPerson(null)} title="Reset password" description={resetPerson ? `Set a temporary password for ${resetPerson.full_name}.` : undefined}><form onSubmit={submitPassword} className="space-y-4 p-5"><Field label="New password · minimum 8 characters"><input type="password" name="new_password" minLength={8} required autoComplete="new-password" className="field-input" /></Field><div className="flex justify-end gap-2"><Button type="button" onClick={() => setResetPerson(null)}>Cancel</Button><Button type="submit" variant="primary" disabled={pending}>Reset password</Button></div></form></Modal>
  </>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-[10px] font-medium text-zinc-700">{label}{children}</label>; }
