import { requirePartner } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedDepartments, getCachedStaffDirectory } from "@/lib/cache/firm-cache";
import Expenses from "./workspace";

export default async function Page() {
  const { profile } = await requirePartner();
  const [{ data: rows, error }, staff, departments] = await Promise.all([
    createAdminClient().from("expense_claims").select("id,user_id,expense_date,location_client,reason,amount_pkr,engagement_id,billable_to_client,status,review_comment").eq("firm_id", profile.firm_id).order("expense_date", { ascending: false }),
    getCachedStaffDirectory(profile.firm_id), getCachedDepartments(profile.firm_id),
  ]);
  return <Expenses rows={rows ?? []} staff={staff.map(({ id, full_name, designation, department_id }) => ({ id, full_name, designation, department: departments.find((d) => d.id === department_id)?.name ?? "Firm-wide" }))} error={error?.message} />;
}
