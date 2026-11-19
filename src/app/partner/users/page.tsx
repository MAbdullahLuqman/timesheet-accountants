import { PageHeading } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/auth/guards";
import TeamAdmin from "../../team/team-admin";

export default async function PartnerUsers() {
  const { profile } = await requirePartner();
  const supabase = await createClient();
  const [{ data: people, error }, { data: departments, error: departmentError }] = await Promise.all([
    createAdminClient().from("profiles").select("id,firm_id,department_id,full_name,email,role,is_active,cost_rate_pkr,bill_rate_pkr,weekly_target_hrs").eq("firm_id", profile.firm_id).order("full_name"),
    supabase.from("departments").select("id,name,firm_id").eq("firm_id", profile.firm_id).order("name"),
  ]);
  if (error || departmentError) return <div role="alert">Could not load the firm directory. {error?.message ?? departmentError?.message}</div>;
  const departmentNames = new Map((departments ?? []).map((department) => [department.id, department.name]));
  const rows = (people ?? []).map((person) => ({ ...person, department_name: person.department_id ? departmentNames.get(person.department_id) ?? "Unknown department" : "Firm-wide" }));
  return <><PageHeading title="User & access control" subtitle="Provision firm identities, manage access, and maintain internal and billing rates." /><TeamAdmin people={rows} departments={departments ?? []} /></>;
}
