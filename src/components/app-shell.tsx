import type { ReactNode } from "react";
import { AppFrame } from "@/components/app-frame";
import { AppStateProvider, type AppProfile } from "@/lib/portal-state";
import { createClient } from "@/lib/supabase/server";
import { getSignedInProfile } from "@/lib/supabase/session";

export async function AppShell({ children }: { children: ReactNode }) {
  const session = await getSignedInProfile();
  if (!session) return children;
  if (session.profile.role === "PARTNER") {
    const appProfile: AppProfile = { id: session.profile.id, firm_id: session.profile.firm_id, department_id: session.profile.department_id, full_name: session.profile.full_name, role: session.profile.role, weekly_target_hrs: session.profile.weekly_target_hrs, department: session.profile.department, firm: session.profile.firm };
    return <AppStateProvider profile={appProfile} activeEngagements={[]}><AppFrame>{children}</AppFrame></AppStateProvider>;
  }
  const supabase = await createClient();
  let engagements = supabase.from("engagements").select("id,client_name,title").eq("firm_id", session.profile.firm_id).eq("status", "ACTIVE");
  engagements = engagements.eq("department_id", session.profile.department_id ?? "00000000-0000-0000-0000-000000000000");
  const { data } = await engagements.order("client_name");
  const activeEngagements = data ?? [];
  const appProfile: AppProfile = { id: session.profile.id, firm_id: session.profile.firm_id, department_id: session.profile.department_id, full_name: session.profile.full_name, role: session.profile.role, weekly_target_hrs: session.profile.weekly_target_hrs, department: session.profile.department, firm: session.profile.firm };
  return <AppStateProvider profile={appProfile} activeEngagements={activeEngagements}><AppFrame>{children}</AppFrame></AppStateProvider>;
}
