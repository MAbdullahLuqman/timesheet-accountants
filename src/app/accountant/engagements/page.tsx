import { PageHeading } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireAccountant } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedDepartments, getCachedEngagementTasks } from "@/lib/cache/firm-cache";
import { TaskBoard } from "@/components/task-board";
import type { TaskStage } from "@/lib/supabase/types";

export default async function AccountantEngagements() {
  const { profile } = await requireAccountant();
  const supabase = await createClient();
  const [{ data, error }, departments, tasks, { data: taskEntries }] = await Promise.all([
    supabase.from("engagements").select("id,client_name,ntn_strn,title,billing_model,department_id").eq("firm_id", profile.firm_id).eq("status", "ACTIVE").order("client_name"),
    getCachedDepartments(profile.firm_id), getCachedEngagementTasks(profile.firm_id),
    createAdminClient().from("time_entries").select("task_id,logged_hours").eq("firm_id", profile.firm_id).not("task_id", "is", null),
  ]);
  const names = new Map(departments.map((department) => [department.id, department.name]));
  const actual = new Map<string, number>();
  for (const entry of taskEntries ?? []) if (entry.task_id) actual.set(entry.task_id, (actual.get(entry.task_id) ?? 0) + Number(entry.logged_hours));
  return <><PageHeading title="Client engagements" subtitle="Active firm work and deliverable progress." />{error ? <p role="alert">Could not load engagements: {error.message}</p> : <div className="overflow-hidden rounded-lg border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Client", "NTN / STRN", "Engagement", "Department", "Billing model"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{(data ?? []).map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-4 py-3 font-medium">{item.client_name}</td><td className="px-4 py-3">{item.ntn_strn}</td><td className="px-4 py-3">{item.title}</td><td className="px-4 py-3">{names.get(item.department_id ?? "") ?? "Unassigned"}</td><td className="px-4 py-3">{item.billing_model}</td></tr>)}</tbody></table></div>}<TaskBoard engagements={(data ?? []).map(({ id, client_name, title }) => ({ id, client_name, title }))} initialTasks={tasks.map((task) => ({ id: task.id, engagement_id: task.engagement_id, title: task.title, stage: task.stage as TaskStage, allocated_hours: Number(task.allocated_hours), actual_hours: actual.get(task.id) ?? 0 }))} /></>;
}
