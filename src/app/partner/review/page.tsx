import { requirePartner } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedDepartments, getCachedEngagements, getCachedStaffDirectory } from "@/lib/cache/firm-cache";
import Review from "./review";

export default async function PartnerReview() {
  const { profile } = await requirePartner();
  const today = new Date();
  const monday = new Date(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  const start = monday.toISOString().slice(0, 10);
  monday.setDate(monday.getDate() + 5);
  const end = monday.toISOString().slice(0, 10);
  const supabase = await createClient();
  const [staff, engagements, departments, { data: entries, error }, { data: audits }, { data: leaves }] = await Promise.all([
    getCachedStaffDirectory(profile.firm_id), getCachedEngagements(profile.firm_id), getCachedDepartments(profile.firm_id),
    supabase.from("time_entries").select("id,user_id,engagement_id,task_code,work_date,logged_hours,billed_hours,notes,status").eq("firm_id", profile.firm_id).gte("work_date", start).lte("work_date", end).order("work_date"),
    supabase.from("time_entry_audits").select("id,time_entry_id,actor_id,action,old_billed_hours,new_billed_hours,comment,created_at").eq("firm_id", profile.firm_id).order("created_at", { ascending: false }).limit(100),
    createAdminClient().from("leave_requests").select("id,user_id,leave_type,start_date,end_date,working_days").eq("firm_id", profile.firm_id).eq("status", "APPROVED").lte("start_date", end).gte("end_date", start),
  ]);
  return <Review initialStart={start} initialError={error?.message} initialData={{ entries: entries ?? [], staff: staff.map(({ id, full_name, department_id, role, weekly_target_hrs }) => ({ id, full_name, department_id, role, weekly_target_hrs })), engagements: engagements.map(({ id, client_name, title, department_id, budget_hours }) => ({ id, client_name, title, department_id, budget_hours })), departments, audits: audits ?? [], leaves: leaves ?? [] }} />;
}
