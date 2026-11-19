import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Department, Firm, Profile, Role } from "@/lib/supabase/types";

export const getSignedInProfile = cache(async function getSignedInProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: row, error } = await supabase.from("profiles")
    .select("id,firm_id,department_id,full_name,email,role,is_active,weekly_target_hrs")
    .eq("id", user.id).maybeSingle();
  if (error || !row || !row.is_active || !["PARTNER", "HEAD", "STAFF"].includes(row.role)) {
    await supabase.auth.signOut();
    redirect("/login?error=profile");
  }

  const [departmentResult, firmResult] = await Promise.all([
    row.department_id
      ? supabase.from("departments").select("id,firm_id,name").eq("id", row.department_id).eq("firm_id", row.firm_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("firms").select("id,name").eq("id", row.firm_id).maybeSingle(),
  ]);
  if (firmResult.error || !firmResult.data) {
    await supabase.auth.signOut();
    redirect("/login?error=profile");
  }
  return {
    user,
    profile: {
      ...row,
      role: row.role as Role,
      cost_rate_pkr: 0,
      bill_rate_pkr: 0,
      weekly_target_hrs: Number(row.weekly_target_hrs),
      department: departmentResult.data as Department | null,
      firm: firmResult.data as Firm,
    } satisfies Profile,
  };
});

export async function requireProfile(roles?: Role[]) {
  const session = await getSignedInProfile();
  if (!session) redirect("/login");
  if (roles && !roles.includes(session.profile.role)) redirect(session.profile.role === "PARTNER" ? "/partner/review" : "/accountant/timesheet");
  return session;
}

export const requireActiveUser = () => requireProfile();
export async function requireAccountant() {
  const session = await requireProfile(["STAFF", "HEAD"]);
  return session;
}
export async function requirePartner() {
  return requireProfile(["PARTNER"]);
}
