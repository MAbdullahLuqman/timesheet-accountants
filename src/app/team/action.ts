"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requirePartner } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function createStaffUser(formData: FormData) {
  const { profile } = await requirePartner();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const designation = String(formData.get("designation") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "STAFF");
  const departmentId = String(formData.get("department_id") ?? "") || null;
  const costRate = Number(formData.get("cost_rate_pkr"));
  const billRate = Number(formData.get("bill_rate_pkr"));
  if (!fullName || !designation || designation.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || !["STAFF", "HEAD", "PARTNER"].includes(role) || !Number.isFinite(costRate) || costRate < 0 || !Number.isFinite(billRate) || billRate < 0) return { error: "Enter a name, designation (up to 100 characters), valid email, password of at least 8 characters, role, and non-negative rates." };
  if ((role === "HEAD" || role === "STAFF") && !departmentId) return { error: "Choose a department for staff and heads." };
  const admin = createAdminClient();
  if (departmentId) {
    const { data: department } = await admin.from("departments").select("id").eq("id", departmentId).eq("firm_id", profile.firm_id).maybeSingle();
    if (!department) return { error: "That department is not in this firm." };
  }
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error || !created.user) return { error: error?.message ?? "Could not create the sign-in account." };
  const { error: profileError } = await admin.from("profiles").insert({ id: created.user.id, firm_id: profile.firm_id, department_id: role === "PARTNER" ? null : departmentId, full_name: fullName, designation, email, role, is_active: true, cost_rate_pkr: costRate, bill_rate_pkr: billRate, weekly_target_hrs: 45 });
  if (profileError) {
    const { error: rollbackError } = await admin.auth.admin.deleteUser(created.user.id);
    if (rollbackError) return { error: `Profile creation failed: ${profileError.message}. Sign-in account cleanup also failed: ${rollbackError.message}` };
    return { error: profileError.message };
  }
  revalidatePath("/partner/users");
  revalidateTag(`firm:${profile.firm_id}:staff`);
  revalidateTag(`firm:${profile.firm_id}:reports`);
  return { success: true };
}

export async function toggleUserActiveStatus(userId: string, nextActiveState: boolean) {
  const { user, profile } = await requirePartner();
  if (!userId || userId === user.id && !nextActiveState || typeof nextActiveState !== "boolean") return { error: "Invalid account status change." };
  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("id").eq("id", userId).eq("firm_id", profile.firm_id).maybeSingle();
  if (!target) return { error: "This user is not in your firm." };
  const { error } = await admin.from("profiles").update({ is_active: nextActiveState }).eq("id", userId).eq("firm_id", profile.firm_id);
  if (error) return { error: error.message };
  const { error: authError } = await admin.auth.admin.updateUserById(userId, { ban_duration: nextActiveState ? "none" : "876000h" });
  if (authError) {
    await admin.from("profiles").update({ is_active: !nextActiveState }).eq("id", userId).eq("firm_id", profile.firm_id);
    return { error: authError.message };
  }
  revalidatePath("/partner/users");
  revalidateTag(`firm:${profile.firm_id}:staff`);
  revalidateTag(`firm:${profile.firm_id}:reports`);
  return { success: true };
}

export async function resetStaffPassword(userId: string, newPassword: string) {
  const { profile } = await requirePartner();
  if (!userId || typeof newPassword !== "string" || newPassword.length < 8) return { error: "New password must be at least 8 characters." };
  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles").select("id").eq("id", userId).eq("firm_id", profile.firm_id).maybeSingle();
  if (!target) return { error: "This user is not in your firm." };
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return { error: error.message };
  revalidatePath("/partner/users");
  revalidateTag(`firm:${profile.firm_id}:staff`);
  return { success: true };
}
