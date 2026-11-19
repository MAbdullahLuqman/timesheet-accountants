import { PageHeading } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/auth/guards";

export default async function PartnerReview() {
  const { profile } = await requirePartner();
  const supabase = await createClient();
  const { data, error } = await supabase.from("time_entries").select("id,user_id,engagement_id,task_code,work_date,logged_hours,billed_hours,notes,status").eq("firm_id", profile.firm_id).eq("status", "SUBMITTED").order("work_date");
  const rows = data ?? [];
  const peopleIds = [...new Set(rows.map((row) => row.user_id))];
  const engagementIds = [...new Set(rows.map((row) => row.engagement_id))];
  const [{ data: people }, { data: engagements }] = await Promise.all([peopleIds.length ? supabase.from("profiles").select("id,full_name").eq("firm_id", profile.firm_id).in("id", peopleIds) : Promise.resolve({ data: [] }), engagementIds.length ? supabase.from("engagements").select("id,client_name,title").eq("firm_id", profile.firm_id).in("id", engagementIds) : Promise.resolve({ data: [] })]);
  const names = new Map((people ?? []).map((person) => [person.id, person.full_name]));
  const clients = new Map((engagements ?? []).map((engagement) => [engagement.id, `${engagement.client_name} · ${engagement.title}`]));
  return <><PageHeading title="End-of-week review" subtitle="Submitted time entries awaiting Managing Partner review." />{error ? <p role="alert">Could not load entries: {error.message}</p> : <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Staff", "Date", "Client / engagement", "Task", "Narration", "Logged hours", "Billed hours"].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-3">{names.get(row.user_id) ?? "Unknown"}</td><td className="px-3 py-3">{row.work_date}</td><td className="px-3 py-3">{clients.get(row.engagement_id) ?? "Unknown"}</td><td className="px-3 py-3">{row.task_code}</td><td className="px-3 py-3">{row.notes}</td><td className="px-3 py-3 tabular-nums">{Number(row.logged_hours).toFixed(2)}</td><td className="px-3 py-3 tabular-nums">{Number(row.billed_hours).toFixed(2)}</td></tr>)}</tbody></table>{!rows.length && <p className="p-6 text-sm text-slate-500">No submitted entries awaiting review.</p>}</div>}</>;
}
