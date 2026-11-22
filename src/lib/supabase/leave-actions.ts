"use server";

import { revalidatePath } from "next/cache";
import { requireAccountant, requirePartner } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

import { leaveAllowance, workingDays, type LeaveType } from "@/lib/leave";

export async function applyForLeave(input: { leave_type: LeaveType; start_date: string; end_date: string; working_days: number; reason: string }) {
  const { user, profile } = await requireAccountant();
  const available = workingDays(input.start_date, input.end_date);
  if (!Object.hasOwn(leaveAllowance, input.leave_type) || !available || available > 366 || !Number.isFinite(input.working_days) || input.working_days < 0.5 || input.working_days > available || input.working_days * 2 % 1 !== 0 || !input.reason?.trim() || input.reason.length > 1000) return { error: "Enter valid dates, half-day increments within the working-day range, and a reason." };
  const admin = createAdminClient();
  const { data: overlap } = await admin.from("leave_requests").select("id").eq("firm_id", profile.firm_id).eq("user_id", user.id).in("status", ["PENDING", "APPROVED"]).lte("start_date", input.end_date).gte("end_date", input.start_date).limit(1);
  if (overlap?.length) return { error: "You already have a pending or approved request in this date range." };
  const { error } = await admin.from("leave_requests").insert({ ...input, reason: input.reason.trim(), firm_id: profile.firm_id, user_id: user.id });
  if (error) return { error: error.message };
  revalidatePath("/accountant/leaves"); revalidatePath("/partner/leaves"); revalidatePath("/partner/review");
  return { success: true };
}
export async function cancelLeave(id: string) {
  const { user, profile } = await requireAccountant();
  const { data, error } = await createAdminClient().from("leave_requests").update({ status: "CANCELLED" }).eq("id", id).eq("firm_id", profile.firm_id).eq("user_id", user.id).eq("status", "PENDING").select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Only your pending requests can be cancelled." };
  revalidatePath("/accountant/leaves"); revalidatePath("/partner/leaves");
  return { success: true };
}
export async function reviewLeave(id: string, decision: "APPROVED" | "REJECTED", comment = "") {
  const { user, profile } = await requirePartner();
  if (!id || !["APPROVED", "REJECTED"].includes(decision) || comment.length > 1000) return { error: "Invalid review decision or comment." };
  const { data, error } = await createAdminClient().from("leave_requests").update({ status: decision, review_comment: comment.trim() || null, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("id", id).eq("firm_id", profile.firm_id).eq("status", "PENDING").select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "This request is no longer pending." };
  revalidatePath("/accountant/leaves"); revalidatePath("/partner/leaves"); revalidatePath("/partner/review");
  return { success: true };
}
