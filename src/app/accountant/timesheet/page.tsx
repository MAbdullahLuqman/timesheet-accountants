import { requireAccountant } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import Timesheet from "./timesheet";
import { getCachedEngagementTasks } from "@/lib/cache/firm-cache";

export default async function Page() {
  const { user, profile } = await requireAccountant();
  const today = new Date();
  const monday = new Date(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  const start = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
  const endDate = new Date(monday);
  endDate.setDate(endDate.getDate() + 5);
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
  const supabase = await createClient();
  const [tasks, { data, error }] = await Promise.all([getCachedEngagementTasks(profile.firm_id), supabase.from("time_entries").select("id,engagement_id,company_name,task_id,task_code,work_date,logged_hours,billable,notes,status,review_comment").eq("firm_id", profile.firm_id).eq("user_id", user.id).gte("work_date", start).lte("work_date", end).order("work_date")]);
  return <Timesheet initialStart={start} initialEntries={error ? [] : data ?? []} initialTasks={tasks.filter((task) => task.stage !== "DONE").map(({ id, engagement_id, title }) => ({ id, engagement_id, title }))} initialError={error?.message} />;
}
