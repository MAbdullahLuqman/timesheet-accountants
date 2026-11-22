import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export const getCachedDepartments = (firmId: string) => unstable_cache(async () => {
  const { data, error } = await createAdminClient().from("departments").select("id,name,firm_id").eq("firm_id", firmId).order("name");
  if (error) throw error;
  return data ?? [];
}, [firmId, "departments"], { tags: ["firm-departments", `firm:${firmId}:departments`], revalidate: 3600 })();

export const getCachedActiveEngagements = (firmId: string) => unstable_cache(async () => {
  const { data, error } = await createAdminClient().from("engagements").select("id,firm_id,department_id,client_name,title").eq("firm_id", firmId).eq("status", "ACTIVE").order("client_name");
  if (error) throw error;
  return data ?? [];
}, [firmId, "active-engagements"], { tags: ["firm-engagements", `firm:${firmId}:engagements`], revalidate: 600 })();

export const getCachedEngagements = (firmId: string) => unstable_cache(async () => {
  const { data, error } = await createAdminClient().from("engagements").select("id,firm_id,department_id,client_name,ntn_strn,title,billing_model,budget_hours,fee_pkr,status").eq("firm_id", firmId).order("client_name");
  if (error) throw error;
  return data ?? [];
}, [firmId, "all-engagements"], { tags: ["firm-engagements", `firm:${firmId}:engagements`], revalidate: 600 })();

export const getCachedEngagementTasks = (firmId: string) => unstable_cache(async () => {
  const { data, error } = await createAdminClient().from("engagement_tasks").select("id,firm_id,engagement_id,assigned_to,title,task_code,stage,allocated_hours,due_date,created_at").eq("firm_id", firmId).order("created_at");
  if (error) throw error;
  return data ?? [];
}, [firmId, "tasks"], { tags: ["firm-tasks", `firm:${firmId}:tasks`], revalidate: 300 })();

export const getCachedStaffDirectory = (firmId: string) => unstable_cache(async () => {
  const { data, error } = await createAdminClient().from("profiles").select("id,firm_id,department_id,full_name,designation,email,role,is_active,cost_rate_pkr,bill_rate_pkr,weekly_target_hrs").eq("firm_id", firmId).order("full_name");
  if (error) throw error;
  return data ?? [];
}, [firmId, "staff"], { tags: ["firm-staff", `firm:${firmId}:staff`], revalidate: 600 })();

export const getCachedPartnerReportsSummary = (firmId: string) => unstable_cache(async () => {
  const admin = createAdminClient();
  const [{ data: people, error: peopleError }, { data: engagements, error: engagementError }, { data: entries, error: entryError }] = await Promise.all([
    admin.from("profiles").select("id,weekly_target_hrs,cost_rate_pkr").eq("firm_id", firmId),
    admin.from("engagements").select("id,client_name,fee_pkr").eq("firm_id", firmId),
    admin.from("time_entries").select("user_id,engagement_id,logged_hours,billed_hours,billable").eq("firm_id", firmId),
  ]);
  if (peopleError || engagementError || entryError) throw peopleError ?? engagementError ?? entryError;
  const rates = new Map((people ?? []).map((person) => [person.id, Number(person.cost_rate_pkr)]));
  const totalLogged = (entries ?? []).reduce((sum, entry) => sum + Number(entry.logged_hours), 0);
  const billed = (entries ?? []).reduce((sum, entry) => sum + Number(entry.billed_hours), 0);
  const billable = (entries ?? []).filter((entry) => entry.billable).reduce((sum, entry) => sum + Number(entry.logged_hours), 0);
  const capacity = (people ?? []).reduce((sum, person) => sum + Number(person.weekly_target_hrs), 0);
  const costByEngagement = new Map<string, number>();
  for (const entry of entries ?? []) costByEngagement.set(entry.engagement_id, (costByEngagement.get(entry.engagement_id) ?? 0) + Number(entry.logged_hours) * (rates.get(entry.user_id) ?? 0));
  const margins = (engagements ?? []).map((engagement) => ({ client_name: engagement.client_name, fee_pkr: Number(engagement.fee_pkr), internal_cost_pkr: costByEngagement.get(engagement.id) ?? 0 }));
  return { total_logged_hours: totalLogged, utilization: capacity ? billable / capacity * 100 : 0, realization: billable ? billed / billable * 100 : 0, margins };
}, [firmId, "reports"], { tags: ["firm-reports", `firm:${firmId}:reports`], revalidate: 300 })();
