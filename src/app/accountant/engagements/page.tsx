import { PageHeading } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireAccountant } from "@/lib/auth/guards";

export default async function AccountantEngagements() {
  const { profile } = await requireAccountant();
  const supabase = await createClient();
  const { data, error } = await supabase.from("engagements").select("id,client_name,ntn_strn,title,billing_model,department_id").eq("firm_id", profile.firm_id).eq("status", "ACTIVE").order("client_name");
  const { data: departments } = await supabase.from("departments").select("id,name").eq("firm_id", profile.firm_id);
  const names = new Map((departments ?? []).map((department) => [department.id, department.name]));
  return <><PageHeading title="Client engagements" subtitle="Active assignments available to your department." />{error ? <p role="alert">Could not load engagements: {error.message}</p> : <div className="overflow-hidden rounded-lg border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Client", "NTN / STRN", "Engagement", "Department", "Billing model"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{(data ?? []).map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-4 py-3 font-medium">{item.client_name}</td><td className="px-4 py-3">{item.ntn_strn}</td><td className="px-4 py-3">{item.title}</td><td className="px-4 py-3">{names.get(item.department_id ?? "") ?? "Unassigned"}</td><td className="px-4 py-3">{item.billing_model}</td></tr>)}</tbody></table></div>}</>;
}
