import { requirePartner } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedStaffDirectory, getCachedDepartments } from "@/lib/cache/firm-cache";
import Leaves from "./workspace";

export default async function Page() {
  const { profile } = await requirePartner();
  const [{ data, error }, staff, departments] = await Promise.all([
    createAdminClient().from("leave_requests").select("id,user_id,leave_type,start_date,end_date,working_days,reason,status,review_comment").eq("firm_id", profile.firm_id).order("start_date", { ascending: false }),
    getCachedStaffDirectory(profile.firm_id), getCachedDepartments(profile.firm_id),
  ]);
  return <Leaves rows={data ?? []} staff={staff.map(({ id, full_name, designation, department_id }) => ({ id, full_name, designation, department: departments.find((d) => d.id === department_id)?.name ?? "Firm-wide" }))} error={error?.message} />;
}
