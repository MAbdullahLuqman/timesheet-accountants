import type { ReactNode } from "react";
import { AppFrame } from "@/components/app-frame";
import { AppStateProvider, type AppProfile } from "@/lib/portal-state";
import { getSignedInProfile } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedActiveEngagements } from "@/lib/cache/firm-cache";

export async function AppShell({ children }: { children: ReactNode }) {
  const session = await getSignedInProfile();
  if (!session) return children;
  if (session.profile.role === "PARTNER") {
    const admin = createAdminClient();
    const [timesheets, expenses, leaves] = await Promise.all([
      admin.from("time_entries").select("id", { count: "exact", head: true }).eq("firm_id", session.profile.firm_id).eq("status", "SUBMITTED"),
      admin.from("expense_claims").select("id", { count: "exact", head: true }).eq("firm_id", session.profile.firm_id).eq("status", "SUBMITTED"),
      admin.from("leave_requests").select("id", { count: "exact", head: true }).eq("firm_id", session.profile.firm_id).eq("status", "PENDING"),
    ]);
    const pendingCounts = { "/partner/review": timesheets.count ?? 0, "/partner/expenses": expenses.count ?? 0, "/partner/leaves": leaves.count ?? 0 };
    const appProfile: AppProfile = { id: session.profile.id, firm_id: session.profile.firm_id, department_id: session.profile.department_id, full_name: session.profile.full_name, role: session.profile.role, weekly_target_hrs: session.profile.weekly_target_hrs, department: session.profile.department, firm: session.profile.firm };
    return <AppStateProvider profile={appProfile} activeEngagements={[]}><AppFrame pendingCounts={pendingCounts}>{children}</AppFrame></AppStateProvider>;
  }
  const activeEngagements = await getCachedActiveEngagements(session.profile.firm_id);
  const appProfile: AppProfile = { id: session.profile.id, firm_id: session.profile.firm_id, department_id: session.profile.department_id, full_name: session.profile.full_name, role: session.profile.role, weekly_target_hrs: session.profile.weekly_target_hrs, department: session.profile.department, firm: session.profile.firm };
  return <AppStateProvider profile={appProfile} activeEngagements={activeEngagements}><AppFrame>{children}</AppFrame></AppStateProvider>;
}
