import { PageHeading } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/auth/guards";
import EngagementList from "../../engagements/engagement-list";

export default async function PartnerEngagements() {
  const { profile } = await requirePartner();
  const supabase = await createClient();
  const [{ data: engagements, error }, { data: departments, error: deptError }] = await Promise.all([
    supabase.from("engagements").select("id,firm_id,department_id,client_name,ntn_strn,title,billing_model,budget_hours,fee_pkr,status").eq("firm_id", profile.firm_id).order("client_name"),
    supabase.from("departments").select("id,name,firm_id").eq("firm_id", profile.firm_id).order("name"),
  ]);
  if (error || deptError) return <div role="alert">Could not load engagements. {error?.message ?? deptError?.message}</div>;
  const rows = engagements ?? [];
  const ids = rows.map((item) => item.id);
  const { data: entries, error: entryError } = ids.length ? await supabase.from("time_entries").select("engagement_id,logged_hours,billed_hours").eq("firm_id", profile.firm_id).in("engagement_id", ids) : { data: [], error: null };
  if (entryError) return <div role="alert">Could not load engagement hours. {entryError.message}</div>;
  const totals = new Map<string, { logged: number; billed: number }>();
  for (const entry of entries ?? []) { const value = totals.get(entry.engagement_id) ?? { logged: 0, billed: 0 }; value.logged += Number(entry.logged_hours); value.billed += Number(entry.billed_hours); totals.set(entry.engagement_id, value); }
  const departmentNames = new Map((departments ?? []).map((item) => [item.id, item.name]));
  const mapped = rows.map((item) => ({ ...item, fee_pkr: Number(item.fee_pkr), budget_hours: Number(item.budget_hours), department_name: departmentNames.get(item.department_id ?? "") ?? "Unassigned", head_name: "—", logged_hours: totals.get(item.id)?.logged ?? 0, billed_hours: totals.get(item.id)?.billed ?? 0 }));
  return <><PageHeading title="Clients & engagements" subtitle="Firm assignments, contract fees, and live budget burn." /><EngagementList rows={mapped} departments={departments ?? []} canManage canSeeFees firmWide /></>;
}
