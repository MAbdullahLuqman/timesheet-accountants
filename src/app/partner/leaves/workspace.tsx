"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, PageHeading } from "@/components/ui";
import { type Leave } from "@/lib/leave";
import { reviewLeave } from "@/lib/supabase/leave-actions";

type Staff = { id: string; full_name: string; designation: string | null; department: string };
export default function Leaves({ rows, staff, error }: { rows: Leave[]; staff: Staff[]; error?: string }) {
  const router = useRouter();
  const [comments, setComments] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState(error ?? "");
  const [pending, startTransition] = useTransition();
  const people = new Map(staff.map((s) => [s.id, s]));
  const act = (id: string, decision: "APPROVED" | "REJECTED") => startTransition(async () => { const result = await reviewLeave(id, decision, comments[id] ?? ""); setNotice(result.error ?? "Leave request reviewed."); if (result.success) router.refresh(); });
  const table = (items: Leave[], actions: boolean) => <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-zinc-50"><tr>{["Staff", "Designation", "Department", "Leave Type", "Date Range", "Days", "Reason", "Status", ...(actions ? ["Decision"] : [])].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{items.map((r) => <tr key={r.id} className="border-t"><td className="p-3">{people.get(r.user_id)?.full_name ?? "Unknown"}</td><td className="p-3">{people.get(r.user_id)?.designation || "—"}</td><td className="p-3">{people.get(r.user_id)?.department ?? "—"}</td><td className="p-3">{r.leave_type.replaceAll("_", " ")}</td><td className="p-3">{r.start_date} to {r.end_date}</td><td className="p-3">{r.working_days}</td><td className="p-3">{r.reason}</td><td className="p-3"><Badge tone={r.status === "APPROVED" ? "green" : r.status === "REJECTED" ? "rose" : "amber"}>{r.status}</Badge></td>{actions && <td className="p-3"><div className="flex gap-1"><Button variant="primary" disabled={pending} onClick={() => act(r.id, "APPROVED")}>Approve</Button><Button disabled={pending} onClick={() => act(r.id, "REJECTED")}>Reject</Button></div><input aria-label={`Review comment for ${people.get(r.user_id)?.full_name ?? "staff"}`} placeholder="Optional comment" maxLength={1000} value={comments[r.id] ?? ""} onChange={(e) => setComments({ ...comments, [r.id]: e.target.value })} className="field-input mt-2" /></td>}</tr>)}{!items.length && <tr><td colSpan={actions ? 9 : 8} className="p-8 text-center text-zinc-500">No leave requests.</td></tr>}</tbody></table></div>;
  return <><PageHeading title="Leave Requests" subtitle="Review applications and see approved team leave." />{notice && <p role="status" className="mb-4 rounded border bg-white p-3 text-xs">{notice}</p>}<h2 className="mb-3 text-sm font-semibold">Pending requests ({rows.filter((r) => r.status === "PENDING").length})</h2>{table(rows.filter((r) => r.status === "PENDING"), true)}<h2 className="mb-3 mt-6 text-sm font-semibold">Team leave calendar list</h2>{table(rows.filter((r) => r.status === "APPROVED").sort((a, b) => a.start_date.localeCompare(b.start_date)), false)}</>;
}
