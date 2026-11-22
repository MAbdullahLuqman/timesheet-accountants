import { requireAccountant } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import Leaves from "./workspace";

export default async function Page() {
  const { user, profile } = await requireAccountant();
  const { data, error } = await createAdminClient().from("leave_requests").select("id,user_id,leave_type,start_date,end_date,working_days,reason,status,review_comment").eq("firm_id", profile.firm_id).eq("user_id", user.id).order("start_date", { ascending: false });
  return <Leaves rows={data ?? []} error={error?.message} />;
}
