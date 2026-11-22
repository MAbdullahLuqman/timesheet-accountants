import { requireAccountant } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import Expenses from "./workspace";

export default async function Page() {
  const { user, profile } = await requireAccountant();
  const admin = createAdminClient();
  const [{ data: rows, error }, { data: engagements }] = await Promise.all([
    admin.from("expense_claims").select("id,user_id,expense_date,location_client,reason,amount_pkr,engagement_id,billable_to_client,status,review_comment").eq("firm_id", profile.firm_id).eq("user_id", user.id).order("expense_date", { ascending: false }),
    admin.from("engagements").select("id,client_name,title").eq("firm_id", profile.firm_id).eq("status", "ACTIVE").order("client_name"),
  ]);
  return <Expenses rows={rows ?? []} engagements={engagements ?? []} name={profile.full_name} error={error?.message} />;
}
